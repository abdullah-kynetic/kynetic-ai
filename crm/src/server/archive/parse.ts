// Parsers for the roadmap archive written by PR #162 (docs/roadmap/). Pure functions, no I/O.

export type ParsedNote = {
  twentyId: string;
  title: string;
  body: string;
  tag: string;
  superseded: boolean;
  createdOn: string;
  updatedOn: string | null;
};

export type ParsedTask = {
  twentyId: string;
  title: string;
  body: string;
  status: 'DONE' | 'IN_PROGRESS' | 'TODO';
  priority: 'P1' | 'P2' | 'P3' | null;
  step: number | null;
  dueOn: string | null;
  createdOn: string;
};

/** First "word group" of a title, lowercased: "REF: SOURCE ..." is `ref`, "PORTAL DEMO CLIENT 02: ..." is `portal-demo-client`. */
export function noteTag(title: string): string {
  if (/^D-\d+/.test(title)) return 'decision';
  const head = /^([A-Z][A-Z0-9 \-()]*?)\s*(?:\d+\s*)?(?::|\s—)/.exec(title)?.[1]?.trim();
  if (!head) return 'general';
  const slug = head
    .replace(/\(.*?\)/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.slice(0, 60) || 'general';
}

const NOTE_META =
  /^_Twenty note `([0-9a-f]+)`, created (\d{4}-\d{2}-\d{2})(?:, updated (\d{4}-\d{2}-\d{2}))?/;

export function parseNote(markdown: string): ParsedNote {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const title = /^# (.+)$/.exec(lines[0] ?? '')?.[1]?.trim();
  if (!title) throw new Error('note has no "# title" first line');
  const metaIdx = lines.findIndex((l) => NOTE_META.test(l));
  const meta = metaIdx >= 0 ? NOTE_META.exec(lines[metaIdx]!) : null;
  if (!meta) throw new Error(`note "${title}" has no Twenty metadata line`);
  const body = lines
    .slice(metaIdx + 1)
    .join('\n')
    .trim();
  return {
    twentyId: meta[1]!,
    title,
    body,
    tag: noteTag(title),
    superseded: /supersed/i.test(title),
    createdOn: meta[2]!,
    updatedOn: meta[3] ?? null
  };
}

const STATUS_HEADING = /^## (DONE|IN_PROGRESS|TODO) \(\d+\)\s*$/;
const TASK_HEADING = /^### (.+)$/;
const TASK_META = /^_`([0-9a-f]+)`, created (\d{4}-\d{2}-\d{2}), due (none|\d{4}-\d{2}-\d{2})_\s*$/;

export function parseTasks(markdown: string): ParsedTask[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: ParsedTask[] = [];
  let status: ParsedTask['status'] | null = null;
  let current: { heading: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current || !status) return;
    const metaIdx = current.lines.findIndex((l) => TASK_META.test(l));
    const meta = metaIdx >= 0 ? TASK_META.exec(current.lines[metaIdx]!) : null;
    if (!meta) throw new Error(`task "${current.heading}" has no metadata line`);
    const tags = [...current.heading.matchAll(/^\s*(?:\[[^\]]*\]\s*)+/g)][0]?.[0] ?? '';
    const priority = /\[(P[123])\]/.exec(tags)?.[1] as ParsedTask['priority'] | undefined;
    const step = /\[Step (\d+)/.exec(tags)?.[1];
    out.push({
      twentyId: meta[1]!,
      title: current.heading.replace(/^\s*(?:\[[^\]]*\]\s*)+/, '').trim() || current.heading,
      body: current.lines
        .slice(metaIdx + 1)
        .join('\n')
        .trim(),
      status,
      priority: priority ?? null,
      step: step ? Number(step) : null,
      dueOn: meta[3] === 'none' ? null : meta[3]!,
      createdOn: meta[2]!
    });
    current = null;
  };

  for (const line of lines) {
    const s = STATUS_HEADING.exec(line);
    if (s) {
      flush();
      status = s[1] as ParsedTask['status'];
      continue;
    }
    // Other "##" headings are task body text ("Historical pre-reconciliation body"), not sections.
    const t = TASK_HEADING.exec(line);
    if (t && status) {
      flush();
      current = { heading: t[1]!.trim(), lines: [] };
      continue;
    }
    current?.lines.push(line);
  }
  flush();
  return out;
}
