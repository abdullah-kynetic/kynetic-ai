import { AppError } from '../../errors';
import type { StorageAdapter } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Builds `<tenant_id>/<segments...>`. Segments may not contain slashes or dot-segments. */
export function tenantKey(tenantId: string, ...segments: string[]): string {
  if (!UUID.test(tenantId)) throw new Error('tenantKey needs a tenant uuid');
  if (segments.length === 0) throw new Error('tenantKey needs at least one segment');
  for (const s of segments) {
    if (!s || s === '.' || s === '..' || s.includes('/') || s.includes('\\')) {
      throw new Error('Invalid storage key segment');
    }
  }
  return [tenantId, ...segments].join('/');
}

/** True only for `<tenantId>/...` with no empty or dot segments. */
export function keyBelongsToTenant(tenantId: string, key: string): boolean {
  const parts = key.split('/');
  return (
    parts.length >= 2 &&
    parts[0] === tenantId &&
    parts.every((p) => p !== '' && p !== '.' && p !== '..' && !p.includes('\\'))
  );
}

/**
 * Mints the 5-minute URL for an object. Call it after authorize(). A key outside the caller's
 * tenant prefix is a 404, the same answer as a missing object, so existence is not leaked.
 */
export async function mintSignedUrl(
  storage: StorageAdapter,
  tenantId: string,
  key: string
): Promise<string> {
  if (!keyBelongsToTenant(tenantId, key)) throw new AppError('NOT_FOUND');
  return storage.signedGetUrl(key);
}
