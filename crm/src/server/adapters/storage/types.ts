/** Signed URLs live five minutes (SECURITY 2.3 item 10). Callers cannot choose another lifetime. */
export const SIGNED_URL_TTL_S = 300;

/** Object storage. Keys are tenant-prefixed by callers (see tenant-keys.ts). */
export interface StorageAdapter {
  put(key: string, body: Uint8Array, opts?: { contentType?: string }): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType?: string } | null>;
  remove(key: string): Promise<void>;
  /** Short-lived GET URL for the browser. Mint it only after authorize(); it grants access by itself. */
  signedGetUrl(key: string): Promise<string>;
}
