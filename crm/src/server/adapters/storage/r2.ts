import { ProviderError } from '../errors';
import { presignGetUrl, signRequestHeaders, encodePath, type SigV4Credentials } from './sigv4';
import { SIGNED_URL_TTL_S, type StorageAdapter } from './types';

export type R2Config = {
  /** Account endpoint, e.g. https://<account>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  /** R2 accepts "auto". */
  region?: string;
  credentials: SigV4Credentials;
};

/** Cloudflare R2 over its S3 API, path-style, with SigV4. Uses fetch so it adds no dependency. */
export class R2Storage implements StorageAdapter {
  private readonly origin: string;
  private readonly region: string;

  constructor(
    private readonly config: R2Config,
    private readonly http: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date()
  ) {
    this.origin = new URL(config.endpoint).origin;
    this.region = config.region ?? 'auto';
  }

  private pathFor(key: string) {
    return `/${this.config.bucket}/${key}`;
  }

  private async send(
    method: 'PUT' | 'GET' | 'DELETE',
    key: string,
    body?: Uint8Array,
    contentType?: string
  ) {
    const path = this.pathFor(key);
    const headers = signRequestHeaders({
      creds: this.config.credentials,
      region: this.region,
      method,
      origin: this.origin,
      path,
      body,
      now: this.now()
    });
    if (contentType) headers['content-type'] = contentType;
    try {
      return await this.http(`${this.origin}${encodePath(path)}`, {
        method,
        headers,
        body: body as BodyInit | undefined
      });
    } catch (cause) {
      throw new ProviderError(
        'transient',
        'storage_unreachable',
        `Storage ${method} failed to connect`
      );
    }
  }

  private fail(method: string, status: number): never {
    // 401/403 mean our credentials or bucket policy are wrong: a config fault, not a retry.
    const kind =
      status === 401 || status === 403
        ? 'config'
        : status >= 500 || status === 429
          ? 'transient'
          : 'permanent';
    throw new ProviderError(kind, `storage_${status}`, `Storage ${method} returned ${status}`);
  }

  async put(key: string, body: Uint8Array, opts?: { contentType?: string }) {
    const res = await this.send('PUT', key, body, opts?.contentType);
    if (!res.ok) this.fail('PUT', res.status);
  }

  async get(key: string) {
    const res = await this.send('GET', key);
    if (res.status === 404) return null;
    if (!res.ok) this.fail('GET', res.status);
    return {
      body: new Uint8Array(await res.arrayBuffer()),
      contentType: res.headers.get('content-type') ?? undefined
    };
  }

  async remove(key: string) {
    const res = await this.send('DELETE', key);
    // S3 delete is idempotent; 404 is fine.
    if (!res.ok && res.status !== 404) this.fail('DELETE', res.status);
  }

  async signedGetUrl(key: string) {
    return presignGetUrl({
      creds: this.config.credentials,
      region: this.region,
      origin: this.origin,
      path: this.pathFor(key),
      expiresInS: SIGNED_URL_TTL_S,
      now: this.now()
    });
  }

  async list(prefix: string) {
    const path = `/${this.config.bucket}`;
    const objects: { key: string; lastModified: Date }[] = [];
    let continuationToken: string | undefined;
    do {
      const params = new URLSearchParams({ 'list-type': '2', prefix });
      if (continuationToken) params.set('continuation-token', continuationToken);
      const query = params.toString();
      const headers = signRequestHeaders({
        creds: this.config.credentials,
        region: this.region,
        method: 'GET',
        origin: this.origin,
        path: `${path}?${query}`,
        body: undefined,
        now: this.now()
      });
      const response = await this.http(`${this.origin}${encodePath(path)}?${query}`, {
        method: 'GET',
        headers
      });
      if (!response.ok) this.fail('LIST', response.status);
      const xml = await response.text();
      for (const match of xml.matchAll(
        /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<LastModified>([^<]+)<\/LastModified>[\s\S]*?<\/Contents>/g
      )) {
        objects.push({
          key: decodeXml(match[1]!),
          lastModified: new Date(match[2]!)
        });
      }
      const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
      continuationToken = next ? decodeXml(next) : undefined;
    } while (continuationToken);
    return objects;
  }
}

function decodeXml(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const number =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[code.toLowerCase()] ?? entity;
  });
}
