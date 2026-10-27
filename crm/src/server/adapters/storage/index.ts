import type { Env } from '../../env';
import { getEnv } from '../../env';
import { ProviderError } from '../errors';
import { FakeStorage } from './fake';
import { R2Storage } from './r2';
import type { StorageAdapter } from './types';

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

let instance: StorageAdapter | undefined;

/**
 * The process-wide storage adapter. Production builds it from the environment (R2, or a config
 * error); other environments use the in-memory fake unless a test swaps one in with setStorage.
 */
export function getStorage(): StorageAdapter {
  if (instance) return instance;
  instance = process.env.NODE_ENV === 'production' ? createStorage(getEnv()) : new FakeStorage();
  return instance;
}

export function setStorage(adapter: StorageAdapter | undefined): void {
  instance = adapter;
}
