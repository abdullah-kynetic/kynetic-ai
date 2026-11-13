import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type postgres from 'postgres';
import { getStorage, type StorageAdapter } from '../adapters/storage';
import { parseNote, parseTasks, type ParsedNote } from './parse';

/** The five Twenty attachments the notes export could not copy (docs/roadmap/README.md). */
export const KNOWN_ATTACHMENTS = [
  'wave2-raw.csv',
  'wave3-raw.csv',
  'wave4-raw.csv',
  'search-queries.csv',
  'kynetic-remaining-work-2026-11-06.md'
] as const;

const CONTENT_TYPES: Record<string, string> = {
  csv: 'text/csv',
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  pdf: 'application/pdf'
};

export type ImportCounts = { notes: number; tasks: number; attachments: number; records: number };
export type ImportResult = ImportCounts & { attachmentFilesUploaded: number };

type RecordsFile = {
  records: Array<{
    object: string;
    twentyId: string;
    label: string;
    createdAt?: string;
    data: Record<string, unknown>;
  }>;
};

async function exists(path: string) {
  return stat(path).then(
    () => true,
    () => false
  );
}

/**
 * Loads docs/roadmap (notes, tasks, records.json) and optional attachment files into the archive
 * tables. Safe to run again: every row is keyed on its Twenty id (or file name) and upserted, so a
 * second run leaves the same row counts. `sql` must bypass row-level security (DATABASE_URL_SEED).
 * Attachment files are read from `<roadmapDir>/attachments/`; a missing file leaves file_key empty
 * until a later run finds it.
 */
export async function importArchive(
  sql: postgres.Sql,
  roadmapDir: string,
  opts: { storage?: StorageAdapter } = {}
): Promise<ImportResult> {
  const noteDir = join(roadmapDir, 'notes');
  const noteFiles = (await readdir(noteDir)).filter((f) => f.endsWith('.md')).sort();
  const notes: ParsedNote[] = [];
  for (const f of noteFiles) notes.push(parseNote(await readFile(join(noteDir, f), 'utf8')));
  const tasks = parseTasks(await readFile(join(roadmapDir, 'tasks.md'), 'utf8'));
  const recordsPath = join(roadmapDir, 'records.json');
  const records: RecordsFile['records'] = (await exists(recordsPath))
    ? (JSON.parse(await readFile(recordsPath, 'utf8')) as RecordsFile).records
    : [];

  let filesUploaded = 0;
  const attachmentDir = join(roadmapDir, 'attachments');
  const attachments: Array<{
    name: string;
    key: string | null;
    size: number | null;
    contentType: string;
  }> = [];
  for (const name of KNOWN_ATTACHMENTS) {
    const ext = name.split('.').pop() ?? '';
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
    const path = join(attachmentDir, name);
    if (await exists(path)) {
      const body = new Uint8Array(await readFile(path));
      const key = `archive/attachments/${name}`;
      await (opts.storage ?? getStorage()).put(key, body, { contentType });
      filesUploaded += 1;
      attachments.push({ name, key, size: body.byteLength, contentType });
    } else {
      attachments.push({ name, key: null, size: null, contentType });
    }
  }

  await sql.begin(async (tx) => {
    for (const n of notes) {
      await tx`insert into archive_notes (twenty_id, title, body, tag, superseded, created_on, updated_on)
        values (${n.twentyId}, ${n.title}, ${n.body}, ${n.tag}, ${n.superseded}, ${n.createdOn}, ${n.updatedOn})
        on conflict (twenty_id) do update set title = excluded.title, body = excluded.body,
          tag = excluded.tag, superseded = excluded.superseded, created_on = excluded.created_on,
          updated_on = excluded.updated_on`;
    }
    for (const t of tasks) {
      await tx`insert into archive_tasks (twenty_id, title, body, status, priority, step, due_on, created_on)
        values (${t.twentyId}, ${t.title}, ${t.body}, ${t.status}, ${t.priority}, ${t.step}, ${t.dueOn}, ${t.createdOn})
        on conflict (twenty_id) do update set title = excluded.title, body = excluded.body,
          status = excluded.status, priority = excluded.priority, step = excluded.step,
          due_on = excluded.due_on, created_on = excluded.created_on`;
    }
    for (const a of attachments) {
      await tx`insert into archive_attachments (file_name, content_type, size_bytes, file_key)
        values (${a.name}, ${a.contentType}, ${a.size}, ${a.key})
        on conflict (file_name) do update set content_type = excluded.content_type,
          size_bytes = coalesce(excluded.size_bytes, archive_attachments.size_bytes),
          file_key = coalesce(excluded.file_key, archive_attachments.file_key)`;
    }
    for (const r of records) {
      await tx`insert into archive_records (object, twenty_id, label, data, created_on)
        values (${r.object}, ${r.twentyId}, ${r.label}, ${tx.json(r.data as postgres.JSONValue)}, ${r.createdAt ? r.createdAt.slice(0, 10) : null})
        on conflict (twenty_id) do update set object = excluded.object, label = excluded.label,
          data = excluded.data, created_on = excluded.created_on`;
    }
  });

  return {
    notes: notes.length,
    tasks: tasks.length,
    attachments: attachments.length,
    records: records.length,
    attachmentFilesUploaded: filesUploaded
  };
}
