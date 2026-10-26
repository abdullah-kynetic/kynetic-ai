/** Object storage. The R2 implementation arrives in M4-03; keys are tenant-prefixed by callers. */
export interface StorageAdapter {
  put(key: string, body: Uint8Array, opts?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType?: string } | null>;
  remove(key: string): Promise<void>;
}
