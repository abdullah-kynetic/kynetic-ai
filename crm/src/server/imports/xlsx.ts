import { createInflateRaw } from 'node:zlib';
import { readSheet } from 'read-excel-file/node';
import { IMPORT_MAX_ROWS } from './csv';

/** Declared uncompressed bytes and entry count are capped before any inflate. */
export const XLSX_MAX_ENTRIES = 64;
export const XLSX_MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;

export type XlsxRejectReason =
  | 'not_zip'
  | 'truncated'
  | 'too_many_entries'
  | 'uncompressed_too_large'
  | 'macros'
  | 'encrypted'
  | 'unsupported_compression'
  | 'invalid_xlsx'
  | 'too_many_rows';

export class XlsxRejectedError extends Error {
  constructor(readonly reason: XlsxRejectReason) {
    super(reason);
    this.name = 'XlsxRejectedError';
  }
}

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
  encrypted: boolean;
};

function u16(buf: Uint8Array, offset: number) {
  return buf[offset]! | (buf[offset + 1]! << 8);
}
function u32(buf: Uint8Array, offset: number) {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  );
}

function findEocd(buf: Uint8Array) {
  const min = Math.max(0, buf.length - 22 - 65_535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06)
      return i;
  }
  return -1;
}

/** Read the central directory only. Nothing is inflated here. */
export function inspectXlsxZip(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22) throw new XlsxRejectedError('not_zip');
  const eocd = findEocd(bytes);
  if (eocd < 0 || eocd + 22 > bytes.length) throw new XlsxRejectedError('not_zip');
  const records = u16(bytes, eocd + 10);
  const cdSize = u32(bytes, eocd + 12);
  const cdOffset = u32(bytes, eocd + 16);
  if (records === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff)
    throw new XlsxRejectedError('uncompressed_too_large');
  if (records > XLSX_MAX_ENTRIES) throw new XlsxRejectedError('too_many_entries');
  if (cdOffset + cdSize > bytes.length) throw new XlsxRejectedError('truncated');
  const entries: ZipEntry[] = [];
  let cursor = cdOffset;
  let declared = 0;
  for (let n = 0; n < records; n++) {
    if (cursor + 46 > bytes.length || u32(bytes, cursor) !== 0x02014b50)
      throw new XlsxRejectedError('truncated');
    const flags = u16(bytes, cursor + 8);
    const method = u16(bytes, cursor + 10);
    const compressedSize = u32(bytes, cursor + 20);
    const uncompressedSize = u32(bytes, cursor + 24);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const localOffset = u32(bytes, cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd + extraLength + commentLength > bytes.length)
      throw new XlsxRejectedError('truncated');
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd));
    const lower = name.toLowerCase();
    if (
      lower.includes('vbaproject') ||
      lower.includes('macrosheet') ||
      lower.endsWith('.xlsm') ||
      lower.includes('activex')
    )
      throw new XlsxRejectedError('macros');
    if ((flags & 0x1) !== 0 || lower.includes('encryptedpackage'))
      throw new XlsxRejectedError('encrypted');
    if (method !== 0 && method !== 8) throw new XlsxRejectedError('unsupported_compression');
    if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff)
      throw new XlsxRejectedError('uncompressed_too_large');
    declared += uncompressedSize;
    if (declared > XLSX_MAX_UNCOMPRESSED_BYTES)
      throw new XlsxRejectedError('uncompressed_too_large');
    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localOffset,
      encrypted: false
    });
    cursor = nameEnd + extraLength + commentLength;
  }
  return entries;
}

function inflateCapped(input: Uint8Array, cap: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const inflator = createInflateRaw();
    const chunks: Buffer[] = [];
    let total = 0;
    inflator.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > cap) {
        inflator.destroy();
        reject(new XlsxRejectedError('uncompressed_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    inflator.on('error', () => reject(new XlsxRejectedError('invalid_xlsx')));
    inflator.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
    inflator.end(Buffer.from(input));
  });
}

/** Inflate only after the directory caps pass, and stop if the real output exceeds the cap. */
export async function openXlsx(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const entries = inspectXlsxZip(bytes);
  const files = new Map<string, Uint8Array>();
  let inflated = 0;
  for (const entry of entries) {
    if (entry.localOffset + 30 > bytes.length) throw new XlsxRejectedError('truncated');
    if (u32(bytes, entry.localOffset) !== 0x04034b50) throw new XlsxRejectedError('truncated');
    const nameLength = u16(bytes, entry.localOffset + 26);
    const extraLength = u16(bytes, entry.localOffset + 28);
    const dataStart = entry.localOffset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataEnd > bytes.length) throw new XlsxRejectedError('truncated');
    const payload = bytes.subarray(dataStart, dataEnd);
    const body =
      entry.method === 0
        ? payload
        : await inflateCapped(payload, XLSX_MAX_UNCOMPRESSED_BYTES - inflated);
    inflated += body.length;
    if (inflated > XLSX_MAX_UNCOMPRESSED_BYTES)
      throw new XlsxRejectedError('uncompressed_too_large');
    files.set(entry.name.replaceAll('\\', '/'), body);
  }
  return files;
}

export type UncachedFormula = { row: number; cell: string };

/** Formula cells with no stored `<v>` value. The formula text itself is never returned. */
export function uncachedFormulaCells(sheetXml: string): UncachedFormula[] {
  const found: UncachedFormula[] = [];
  const pattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for (const match of sheetXml.matchAll(pattern)) {
    const inner = match[2];
    if (inner == null || !/<f[\s>]/.test(inner)) continue;
    if (/<v[\s>]/.test(inner) || /<is[\s>]/.test(inner)) continue;
    const ref = /r="([A-Z]+)(\d+)"/.exec(match[1] ?? '');
    found.push({
      row: ref ? Number(ref[2]) : 0,
      cell: ref ? `${ref[1]}${ref[2]}` : 'unknown'
    });
  }
  return found;
}

function firstSheetPath(files: Map<string, Uint8Array>): string | null {
  const workbook = files.get('xl/workbook.xml');
  const rels = files.get('xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) return null;
  const book = new TextDecoder().decode(workbook);
  const relationships = new TextDecoder().decode(rels);
  const sheet = /<sheet\b[^>]*\bid="([^"]+)"/.exec(book);
  if (!sheet) return null;
  const blocks = relationships.match(/<Relationship\b[^>]*>/g) ?? [];
  const target = blocks
    .map((block) => ({
      id: /Id="([^"]+)"/.exec(block)?.[1],
      target: /Target="([^"]+)"/.exec(block)?.[1]
    }))
    .find((item) => item.id === sheet[1])?.target;
  if (!target) return null;
  const path = target.replace(/^\//, '');
  return path.startsWith('xl/') ? path : `xl/${path}`;
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

export type XlsxTable = {
  rows: string[][];
  blocked: Map<number, string>;
};

/**
 * First sheet only. Values come from read-excel-file, which returns stored cell values and does
 * not calculate formulas. Cells whose formula has no cached value block that row.
 */
export async function parseImportXlsx(bytes: Uint8Array): Promise<XlsxTable> {
  const files = await openXlsx(bytes);
  const sheetPath = firstSheetPath(files);
  const sheetXml = sheetPath ? files.get(sheetPath) : undefined;
  const blocked = new Map<number, string>();
  if (sheetXml) {
    const groups = new Map<number, string[]>();
    for (const cell of uncachedFormulaCells(new TextDecoder().decode(sheetXml))) {
      const list = groups.get(cell.row) ?? [];
      list.push(cell.cell);
      groups.set(cell.row, list);
    }
    for (const [row, cells] of groups) {
      blocked.set(
        row,
        `formula_not_cached: ${cells.join(', ')} has no saved value. Save the spreadsheet so the calculated value is stored, then upload it again.`
      );
    }
  }
  let grid: unknown[][];
  try {
    grid = (await readSheet(Buffer.from(bytes), 1)) as unknown[][];
  } catch {
    throw new XlsxRejectedError('invalid_xlsx');
  }
  const width = grid.reduce((max, row) => Math.max(max, row.length), 0);
  const rows = grid.map((row) => Array.from({ length: width }, (_, index) => cellText(row[index])));
  let end = rows.length;
  while (end > 1 && rows[end - 1]!.every((cell) => cell === '')) end--;
  const trimmed = rows.slice(0, end);
  if (trimmed.length > IMPORT_MAX_ROWS + 1) throw new XlsxRejectedError('too_many_rows');
  return { rows: trimmed, blocked };
}
