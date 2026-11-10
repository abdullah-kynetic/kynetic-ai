import { parseImportCsv } from './csv';
import { parseImportXlsx, XlsxRejectedError, type XlsxRejectReason } from './xlsx';

export type ImportTable = {
  rows: string[][];
  blocked: ReadonlyMap<number, string>;
};

export async function loadImportTable(fileType: string, body: Uint8Array): Promise<ImportTable> {
  if (fileType === 'csv') return { rows: parseImportCsv(body), blocked: new Map() };
  if (fileType === 'xlsx') return parseImportXlsx(body);
  throw new XlsxRejectedError('invalid_xlsx');
}

export function isXlsxReject(error: unknown): error is XlsxRejectedError {
  return error instanceof XlsxRejectedError;
}

export type { XlsxRejectReason };
