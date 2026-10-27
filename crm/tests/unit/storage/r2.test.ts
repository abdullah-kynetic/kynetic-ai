import { describe, expect, it } from 'vitest';
import { AppError } from '@/server/errors';
import { ProviderError } from '@/server/adapters/errors';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { R2Storage } from '@/server/adapters/storage/r2';
import { presignGetUrl } from '@/server/adapters/storage/sigv4';
import {
  keyBelongsToTenant,
  mintSignedUrl,
  tenantKey
} from '@/server/adapters/storage/tenant-keys';
import { createStorage } from '@/server/adapters/storage';
import { parseEnv } from '@/server/env';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const creds = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
};

describe('F-27 SigV4 presign', () => {
  it('matches the AWS documented example signature', () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
    const url = presignGetUrl({
      creds,
      region: 'us-east-1',
      origin: 'https://examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      expiresInS: 86400,
      now: new Date('2013-05-24T00:00:00Z')
    });
    expect(url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'
    );
  });
});

describe('F-27 R2 adapter', () => {
  const now = () => new Date('2026-10-26T12:00:00Z');
  const config = {
    endpoint: 'https://acct.r2.cloudflarestorage.com',
    bucket: 'kynetic',
    credentials: creds
  };

  it('signs URLs that expire in 5 minutes and point at the bucket path', async () => {
    const r2 = new R2Storage(config, fetch, now);
    const url = new URL(await r2.signedGetUrl(`${A}/calls/c 1.mp3`));
    expect(url.origin).toBe(config.endpoint);
    expect(url.pathname).toBe(`/kynetic/${A}/calls/c%201.mp3`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261026T120000Z');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('puts, gets and removes with signed headers and never sends the secret', async () => {
    const seen: { method?: string; url: string; headers: Record<string, string> }[] = [];
    const http = (async (url: string, init: RequestInit) => {
      seen.push({ url, method: init.method, headers: init.headers as Record<string, string> });
      if (init.method === 'GET')
        return new Response('abc', { headers: { 'content-type': 'audio/mpeg' } });
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const r2 = new R2Storage(config, http, now);
    await r2.put(`${A}/x.mp3`, new Uint8Array([1, 2]), { contentType: 'audio/mpeg' });
    const got = await r2.get(`${A}/x.mp3`);
    await r2.remove(`${A}/x.mp3`);
    expect(got?.contentType).toBe('audio/mpeg');
    expect(new TextDecoder().decode(got!.body)).toBe('abc');
    expect(seen.map((s) => s.method)).toEqual(['PUT', 'GET', 'DELETE']);
    for (const s of seen) {
      expect(s.headers.authorization).toMatch(
        /^AWS4-HMAC-SHA256 Credential=AKIA.*\/auto\/s3\/aws4_request/
      );
      expect(JSON.stringify(s)).not.toContain(creds.secretAccessKey);
    }
    expect(seen[0]!.headers['content-type']).toBe('audio/mpeg');
  });

  it('returns null for a missing object and classifies failures', async () => {
    const status = (n: number) =>
      new R2Storage(
        config,
        (async () => new Response(null, { status: n })) as unknown as typeof fetch,
        now
      );
    expect(await status(404).get(`${A}/x`)).toBeNull();
    await expect(status(403).get(`${A}/x`)).rejects.toMatchObject({ kind: 'config' });
    await expect(status(503).put(`${A}/x`, new Uint8Array())).rejects.toMatchObject({
      kind: 'transient'
    });
    await expect(status(404).remove(`${A}/x`)).resolves.toBeUndefined();
    const down = new R2Storage(
      config,
      (async () => {
        throw new Error('boom');
      }) as typeof fetch,
      now
    );
    await expect(down.get(`${A}/x`)).rejects.toBeInstanceOf(ProviderError);
  });
});

describe('F-27 tenant keys and signed URL minting', () => {
  it('builds tenant-prefixed keys and rejects traversal', () => {
    expect(tenantKey(A, 'calls', 'c1.mp3')).toBe(`${A}/calls/c1.mp3`);
    expect(() => tenantKey(A, '..', 'x')).toThrow();
    expect(() => tenantKey(A, 'a/b')).toThrow();
    expect(() => tenantKey('not-a-uuid', 'x')).toThrow();
  });

  it('accepts only keys under the caller tenant', () => {
    expect(keyBelongsToTenant(A, `${A}/calls/x.mp3`)).toBe(true);
    expect(keyBelongsToTenant(A, `${B}/calls/x.mp3`)).toBe(false);
    expect(keyBelongsToTenant(A, `${A}/../${B}/x`)).toBe(false);
    expect(keyBelongsToTenant(A, `${A}//x`)).toBe(false);
    expect(keyBelongsToTenant(A, A)).toBe(false);
    expect(keyBelongsToTenant(A, `${A}x/y`)).toBe(false);
  });

  it("another tenant's key is NOT_FOUND (404), not forbidden", async () => {
    const storage = new FakeStorage();
    const err = await mintSignedUrl(storage, A, `${B}/calls/x.mp3`).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.status).toBe(404);
  });

  it('a minted URL works inside 5 minutes and is refused after', async () => {
    let t = new Date('2026-10-26T12:00:00Z').getTime();
    const storage = new FakeStorage(() => new Date(t));
    await storage.put(`${A}/calls/x.mp3`, new Uint8Array([9]));
    const url = await mintSignedUrl(storage, A, `${A}/calls/x.mp3`);
    t += 299_000;
    expect(storage.fetchSigned(url)?.body).toEqual(new Uint8Array([9]));
    t += 2_000;
    expect(storage.fetchSigned(url)).toBeNull();
  });
});

describe('F-27 storage config', () => {
  const base = {
    NODE_ENV: 'production',
    APP_BASE_URL: 'https://app.example.com',
    DATABASE_URL: 'postgres://u:p@h/db',
    DATABASE_URL_AUTH: 'postgres://a:p@h/db',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32)
  };
  const storage = {
    STORAGE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    STORAGE_ACCESS_KEY_ID: 'id',
    STORAGE_SECRET_ACCESS_KEY: 'secret',
    STORAGE_BUCKET: 'kynetic'
  };

  it('requires all four storage variables together', () => {
    expect(() => parseEnv({ ...base, STORAGE_BUCKET: 'kynetic' })).toThrow(/STORAGE_ENDPOINT/);
    expect(() => parseEnv({ ...base, ...storage })).not.toThrow();
  });

  it('builds R2 when configured and fails loudly in production when not', () => {
    expect(createStorage(parseEnv({ ...base, ...storage }))).toBeInstanceOf(R2Storage);
    expect(() => createStorage(parseEnv(base))).toThrow(/not configured/);
    expect(createStorage(parseEnv({ ...base, NODE_ENV: 'test' }))).toBeInstanceOf(FakeStorage);
  });
});
