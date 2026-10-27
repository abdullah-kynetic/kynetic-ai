import { createHash, createHmac } from 'node:crypto';

export type SigV4Credentials = { accessKeyId: string; secretAccessKey: string };

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD';

const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest();
export const sha256Hex = (data: string | Uint8Array) =>
  createHash('sha256').update(data).digest('hex');

/** RFC 3986 encoding that SigV4 requires (encodeURIComponent leaves !'()* alone). */
const encode = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );

/** S3 does not double-encode: each path segment is encoded once and slashes are kept. */
export const encodePath = (path: string) => path.split('/').map(encode).join('/');

const amzDate = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

function signingKey(secret: string, date: string, region: string) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), SERVICE), 'aws4_request');
}

function sign(
  creds: SigV4Credentials,
  region: string,
  stamp: string,
  canonicalRequest: string
): { scope: string; signature: string } {
  const date = stamp.slice(0, 8);
  const scope = `${date}/${region}/${SERVICE}/aws4_request`;
  const toSign = [ALGORITHM, stamp, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(creds.secretAccessKey, date, region))
    .update(toSign)
    .digest('hex');
  return { scope, signature };
}

/** Query-string signed URL (GET). `path` is the raw, unencoded request path starting with "/". */
export function presignGetUrl(opts: {
  creds: SigV4Credentials;
  region: string;
  origin: string;
  path: string;
  expiresInS: number;
  now: Date;
}): string {
  const { creds, region, origin, path, expiresInS, now } = opts;
  const host = new URL(origin).host;
  const stamp = amzDate(now);
  const scope = `${stamp.slice(0, 8)}/${region}/${SERVICE}/aws4_request`;
  const params: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': `${creds.accessKeyId}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(expiresInS),
    'X-Amz-SignedHeaders': 'host'
  };
  const query = Object.keys(params)
    .sort()
    .map((k) => `${encode(k)}=${encode(params[k]!)}`)
    .join('&');
  const canonicalPath = encodePath(path);
  const canonicalRequest = [
    'GET',
    canonicalPath,
    query,
    `host:${host}\n`,
    'host',
    UNSIGNED_PAYLOAD
  ].join('\n');
  const { signature } = sign(creds, region, stamp, canonicalRequest);
  return `${origin}${canonicalPath}?${query}&X-Amz-Signature=${signature}`;
}

/** Header-signed request (PUT, GET, DELETE) with the body hashed. Returns the headers to send. */
export function signRequestHeaders(opts: {
  creds: SigV4Credentials;
  region: string;
  method: string;
  origin: string;
  path: string;
  body?: Uint8Array;
  now: Date;
}): Record<string, string> {
  const { creds, region, method, origin, path, body, now } = opts;
  const host = new URL(origin).host;
  const stamp = amzDate(now);
  const payloadHash = sha256Hex(body ?? '');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${stamp}\n`;
  const canonicalRequest = [
    method,
    encodePath(path),
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const { scope, signature } = sign(creds, region, stamp, canonicalRequest);
  return {
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': stamp,
    authorization: `${ALGORITHM} Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}
