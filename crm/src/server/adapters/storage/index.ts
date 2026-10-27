import { FakeStorage } from './fake';
import type { StorageAdapter } from './types';

export type { StorageAdapter } from './types';

let instance: StorageAdapter | undefined;

/**
 * The storage adapter. The R2 implementation arrives in M4-03; until then only the in-memory fake
 * exists, so production refuses rather than quietly losing files.
 */
export function getStorage(): StorageAdapter {
  if (process.env.NODE_ENV === 'production') throw new Error('Object storage is not configured');
  return (instance ??= new FakeStorage());
}

export function setStorage(adapter: StorageAdapter | undefined): void {
  instance = adapter;
import type { Env } from '../../env';
import { ProviderError } from '../errors';
import { R2Storage } from './r2';

export { SIGNED_URL_TTL_S, type StorageAdapter } from './types';
export { keyBelongsToTenant, mintSignedUrl, tenantKey } from './tenant-keys';

/** R2 when configured; the in-memory fake in test; otherwise a config error (never a silent fake). */
export function createStorage(env: Env): StorageAdapter {
  const { STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET } =
    env;
  if (STORAGE_ENDPOINT && STORAGE_ACCESS_KEY_ID && STORAGE_SECRET_ACCESS_KEY && STORAGE_BUCKET) {
    return new R2Storage({
      endpoint: STORAGE_ENDPOINT,
      bucket: STORAGE_BUCKET,
      region: env.STORAGE_REGION,
      credentials: {
        accessKeyId: STORAGE_ACCESS_KEY_ID,
        secretAccessKey: STORAGE_SECRET_ACCESS_KEY
      }
    });
  }
  if (env.NODE_ENV === 'test') return new FakeStorage();
  throw new ProviderError('config', 'storage_not_configured', 'Object storage is not configured');
}
