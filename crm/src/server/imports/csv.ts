export const IMPORT_MAX_ROWS = 50_000;

/** Parse UTF-8 CSV without evaluating cell contents. Row limit excludes the header. */
export function parseImportCsv(bytes: Uint8Array): string[][] {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === '"' && cell === '' && !closed) quoted = true;
    else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (ch !== ',') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        rows.push(row); row = [];
        if (rows.length > IMPORT_MAX_ROWS + 1) throw new Error('too_many_rows');
      }
    } else {
      if (closed || ch === '"') throw new Error('invalid_csv');
      cell += ch;
    }
  }
  if (quoted) throw new Error('invalid_csv');
  if (row.length || cell || closed) { row.push(cell); rows.push(row); }
  if (rows.length > IMPORT_MAX_ROWS + 1) throw new Error('too_many_rows');
  return rows;
}
