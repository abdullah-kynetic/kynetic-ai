import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { AppError } from '../errors';
import { withPlatform, type PlatformContext } from '../tenancy';

export const ARCHIVE_PAGE_SIZE = 25;

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const page = z.preprocess(blank, z.coerce.number().int().min(1).max(500).default(1));
const text = z.preprocess(blank, z.string().trim().max(200).optional());
const date = z.preprocess(blank, z.iso.date().optional());

export const noteFiltersSchema = z.object({
  q: text,
  tag: z.preprocess(blank, z.string().trim().max(60).optional()),
  from: date,
  to: date,
  hideSuperseded: z
    .preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean())
    .optional(),
  page
});
export const taskFiltersSchema = z.object({
  q: text,
  status: z.preprocess(blank, z.enum(['DONE', 'IN_PROGRESS', 'TODO']).optional()),
  step: z.preprocess(blank, z.coerce.number().int().min(1).max(99).optional()),
  dueBefore: date,
  page
});
export const recordFiltersSchema = z.object({
  object: z.preprocess(
    blank,
    z.enum(['companies', 'people', 'opportunities', 'call_logs', 'other']).optional()
  ),
  page
});

type Raw = Record<string, unknown>;
type Opts = { db?: Db };
export type Paged<T> = { rows: T[]; page: number; hasNext: boolean };

function requireStaff(ctx: PlatformContext) {
  if (ctx.role !== 'admin' && ctx.role !== 'va') throw new AppError('FORBIDDEN');
}

function like(q: string) {
  return `%${q.replace(/[\\%_]/g, '\\$&')}%`;
}

function rows(res: unknown): Raw[] {
  return Array.from(res as Raw[]);
}

function paged<T>(raw: Raw[], pageNo: number, map: (r: Raw) => T): Paged<T> {
  return {
    rows: raw.slice(0, ARCHIVE_PAGE_SIZE).map(map),
    page: pageNo,
    hasNext: raw.length > ARCHIVE_PAGE_SIZE
  };
}

const d = (v: unknown) =>
  v == null ? null : new Date(v as string | Date).toISOString().slice(0, 10);

export type NoteRow = {
  id: string;
  twentyId: string;
  title: string;
  tag: string;
  superseded: boolean;
  createdOn: string | null;
  snippet: string;
};
export type NoteDetail = NoteRow & { body: string; updatedOn: string | null };

/** Search by title and text (full-text, plus a plain substring match so exact phrases always hit). */
export async function searchNotes(
  ctx: PlatformContext,
  input: z.input<typeof noteFiltersSchema>,
  opts: Opts = {}
): Promise<Paged<NoteRow>> {
  requireStaff(ctx);
  const f = noteFiltersSchema.parse(input);
  const q = f.q ?? null;
  const pat = q ? like(q) : null;
  const offset = (f.page - 1) * ARCHIVE_PAGE_SIZE;
  const raw = await withPlatform(
    ctx,
    async (tx) =>
      rows(
        await tx.execute(sql`
          select id, twenty_id, title, tag, superseded, created_on,
            case when ${q}::text is null then left(body, 220)
              else ts_headline('english', body, websearch_to_tsquery('english', ${q}::text),
                'MaxWords=35, MinWords=15, ShortWord=2, MaxFragments=1') end as snippet
          from archive_notes
          where (${q}::text is null
              or search @@ websearch_to_tsquery('english', ${q}::text)
              or title ilike ${pat}::text escape '\\' or body ilike ${pat}::text escape '\\')
            and (${f.tag ?? null}::text is null or tag = ${f.tag ?? null}::text)
            and (${f.from ?? null}::date is null or created_on >= ${f.from ?? null}::date)
            and (${f.to ?? null}::date is null or created_on <= ${f.to ?? null}::date)
            and (${f.hideSuperseded ?? false} = false or superseded = false)
          order by case when ${q}::text is null then 0
            else ts_rank(search, websearch_to_tsquery('english', ${q}::text)) end desc,
            created_on desc, title
          limit ${ARCHIVE_PAGE_SIZE + 1} offset ${offset}`)
      ),
    opts
  );
  return paged(raw, f.page, (r) => ({
    id: String(r.id),
    twentyId: String(r.twenty_id),
    title: String(r.title),
    tag: String(r.tag),
    superseded: Boolean(r.superseded),
    createdOn: d(r.created_on),
    snippet: String(r.snippet ?? '')
  }));
}

export async function listNoteTags(ctx: PlatformContext, opts: Opts = {}) {
  requireStaff(ctx);
  const raw = await withPlatform(
    ctx,
    async (tx) =>
      rows(
        await tx.execute(
          sql`select tag, count(*)::int as n from archive_notes group by tag order by n desc, tag`
        )
      ),
    opts
  );
  return raw.map((r) => ({ tag: String(r.tag), count: Number(r.n) }));
}

export async function getNote(
  ctx: PlatformContext,
  id: string,
  opts: Opts = {}
): Promise<NoteDetail> {
  requireStaff(ctx);
  const noteId = z.uuid().safeParse(id);
  if (!noteId.success) throw new AppError('NOT_FOUND');
  const [r] = await withPlatform(
    ctx,
    async (tx) =>
      rows(
        await tx.execute(
          sql`select id, twenty_id, title, tag, superseded, created_on, updated_on, body from archive_notes where id = ${noteId.data}::uuid`
        )
      ),
    opts
  );
  if (!r) throw new AppError('NOT_FOUND');
  return {
    id: String(r.id),
    twentyId: String(r.twenty_id),
    title: String(r.title),
    tag: String(r.tag),
    superseded: Boolean(r.superseded),
    createdOn: d(r.created_on),
    updatedOn: d(r.updated_on),
    snippet: '',
    body: String(r.body)
  };
}

export type TaskRow = {
  id: string;
  twentyId: string;
  title: string;
  body: string;
  status: 'DONE' | 'IN_PROGRESS' | 'TODO';
  priority: string | null;
  step: number | null;
  dueOn: string | null;
  createdOn: string | null;
};

export async function searchTasks(
  ctx: PlatformContext,
  input: z.input<typeof taskFiltersSchema>,
  opts: Opts = {}
): Promise<Paged<TaskRow>> {
  requireStaff(ctx);
  const f = taskFiltersSchema.parse(input);
  const q = f.q ?? null;
  const pat = q ? like(q) : null;
  const offset = (f.page - 1) * ARCHIVE_PAGE_SIZE;
  const raw = await withPlatform(
    ctx,
    async (tx) =>
      rows(
        await tx.execute(sql`
          select id, twenty_id, title, body, status, priority, step, due_on, created_on
          from archive_tasks
          where (${q}::text is null
              or search @@ websearch_to_tsquery('english', ${q}::text)
              or title ilike ${pat}::text escape '\\' or body ilike ${pat}::text escape '\\')
            and (${f.status ?? null}::text is null or status = ${f.status ?? null}::text)
            and (${f.step ?? null}::int is null or step = ${f.step ?? null}::int)
            and (${f.dueBefore ?? null}::date is null or due_on <= ${f.dueBefore ?? null}::date)
          order by case status when 'IN_PROGRESS' then 0 when 'TODO' then 1 else 2 end,
            step nulls last, priority nulls last, created_on desc, title
          limit ${ARCHIVE_PAGE_SIZE + 1} offset ${offset}`)
      ),
    opts
  );
  return paged(raw, f.page, (r) => ({
    id: String(r.id),
    twentyId: String(r.twenty_id),
    title: String(r.title),
    body: String(r.body),
    status: r.status as TaskRow['status'],
    priority: (r.priority as string | null) ?? null,
    step: r.step == null ? null : Number(r.step),
    dueOn: d(r.due_on),
    createdOn: d(r.created_on)
  }));
}

export type AttachmentRow = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  available: boolean;
};

export async function listAttachments(
  ctx: PlatformContext,
  opts: Opts = {}
): Promise<AttachmentRow[]> {
  requireStaff(ctx);
  const raw = await withPlatform(
    ctx,
    async (tx) =>
      rows(
        await tx.execute(
          sql`select id, file_name, content_type, size_bytes, file_key is not null as available from archive_attachments order by file_name`
        )
      ),
    opts
  );
  return raw.map((r) => ({
    id: String(r.id),
    fileName: String(r.file_name),
    contentType: String(r.content_type),
    sizeBytes: r.size_bytes == null ? null : Number(r.size_bytes),
    available: Boolean(r.available)
  }));
}

export type RecordRow = {
  id: string;
  object: string;
  twentyId: string;
  label: string;
  data: Record<string, unknown>;
  createdOn: string | null;
};

export async function listRecords(
  ctx: PlatformContext,
  input: z.input<typeof recordFiltersSchema>,
  opts: Opts = {}
): Promise<Paged<RecordRow>> {
  requireStaff(ctx);
  const f = recordFiltersSchema.parse(input);
  const offset = (f.page - 1) * ARCHIVE_PAGE_SIZE;
  const raw = await withPlatform(
    ctx,
    async (tx) =>
      rows(
        await tx.execute(sql`
          select id, object, twenty_id, label, data, created_on from archive_records
          where (${f.object ?? null}::text is null or object = ${f.object ?? null}::text)
          order by object, label
          limit ${ARCHIVE_PAGE_SIZE + 1} offset ${offset}`)
      ),
    opts
  );
  return paged(raw, f.page, (r) => ({
    id: String(r.id),
    object: String(r.object),
    twentyId: String(r.twenty_id),
    label: String(r.label),
    data: (r.data ?? {}) as Record<string, unknown>,
    createdOn: d(r.created_on)
  }));
}
