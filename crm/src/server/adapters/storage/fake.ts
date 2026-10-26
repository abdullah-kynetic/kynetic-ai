import type { StorageAdapter } from './types';

export class FakeStorage implements StorageAdapter {
  private readonly objects = new Map<string, { body: Uint8Array; contentType?: string }>();

  async put(key: string, body: Uint8Array, opts?: { contentType?: string }) {
    this.objects.set(key, { body, contentType: opts?.contentType });
  }

  async get(key: string) {
    return this.objects.get(key) ?? null;
  }

  async remove(key: string) {
    this.objects.delete(key);
  }
}
