import { getEnv, type Env } from '../../env';
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

/** Process-wide adapter built from the environment on first use; tests replace it with setStorage. */
export function getStorage(): StorageAdapter {
  return (instance ??= createStorage(getEnv()));
}

export function getOptionalStorage(): StorageAdapter | null {
  try {
    return getStorage();
  } catch {
    return null;
  }
}

export function setStorage(adapter: StorageAdapter | undefined): void {
  instance = adapter;
}
