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
}
