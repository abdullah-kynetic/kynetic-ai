import { SIGNED_URL_TTL_S, type StorageAdapter } from './types';

const FAKE_ORIGIN = 'https://fake-storage.invalid/';

export class FakeStorage implements StorageAdapter {
  private readonly objects = new Map<string, { body: Uint8Array; contentType?: string }>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async put(key: string, body: Uint8Array, opts?: { contentType?: string }) {
    this.objects.set(key, { body, contentType: opts?.contentType });
  }

  async get(key: string) {
    return this.objects.get(key) ?? null;
  }

  async remove(key: string) {
    this.objects.delete(key);
  }

  async signedGetUrl(key: string) {
    const expires = Math.floor(this.now().getTime() / 1000) + SIGNED_URL_TTL_S;
    return `${FAKE_ORIGIN}${encodeURI(key)}?expires=${expires}`;
  }

  /** Test helper: what the browser would receive for a fake signed URL, or null once it has expired. */
  fetchSigned(url: string) {
    const parsed = new URL(url);
    const expires = Number(parsed.searchParams.get('expires'));
    if (!Number.isFinite(expires) || this.now().getTime() / 1000 >= expires) return null;
    return this.objects.get(decodeURIComponent(parsed.pathname.slice(1))) ?? null;
  }
}
