import { z } from 'zod';
import { ValidationError } from '../errors';

// Shared list plumbing for the service API: a capped page size and an opaque keyset cursor over
// (timestamp, id), newest first. The cursor carries no tenant or token data; it only positions the page.

export const SERVICE_PAGE_MAX = 100;
export const SERVICE_PAGE_DEFAULT = 25;

export const pageShape = {
  limit: z.coerce.number().int().min(1).max(SERVICE_PAGE_MAX).default(SERVICE_PAGE_DEFAULT),
  cursor: z.string().min(1).max(300).optional()
};

export const updatedSinceSchema = z.iso.datetime({ offset: true }).optional();

const cursorSchema = z.object({ at: z.string().min(1), id: z.uuid() });

export function encodeCursor(at: string, id: string): string {
  return Buffer.from(JSON.stringify({ at, id })).toString('base64url');
}

export function decodeCursor(raw: string | undefined): { at: string; id: string } | null {
  if (!raw) return null;
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    if (Number.isNaN(Date.parse(parsed.at))) throw new Error('bad date');
    return parsed;
  } catch {
    throw new ValidationError({ cursor: ['invalid'] });
  }
}

/** Escapes LIKE wildcards so a search term is matched literally. */
export const likeLiteral = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Names of the filters a caller used, for audit rows. Values are never logged: they can be names. */
export function usedFilters(q: Record<string, unknown>): string[] {
  return Object.keys(q)
    .filter((k) => k !== 'limit' && k !== 'cursor' && q[k] !== undefined)
    .sort();
}
