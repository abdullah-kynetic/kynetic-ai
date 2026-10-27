import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ValidationError } from '../errors';

// SECURITY 5.3: PNG, JPEG or WebP only, 1 MB, dimensions capped, re-encoded to strip metadata, SVG rejected.
export const LOGO_MAX_BYTES = 1_048_576;
export const LOGO_MAX_INPUT_PIXELS = 4096;
export const LOGO_OUTPUT_PX = 512;

const TYPES = {
  png: { mime: 'image/png', exts: ['png'] },
  jpeg: { mime: 'image/jpeg', exts: ['jpg', 'jpeg'] },
  webp: { mime: 'image/webp', exts: ['webp'] }
} as const;
type Kind = keyof typeof TYPES;

function sniff(b: Uint8Array): Kind | 'svg' | null {
  const hex = (from: number, n: number) => Buffer.from(b.subarray(from, from + n)).toString('hex');
  if (hex(0, 8) === '89504e470d0a1a0a') return 'png';
  if (hex(0, 3) === 'ffd8ff') return 'jpeg';
  if (
    Buffer.from(b.subarray(0, 4)).toString() === 'RIFF' &&
    Buffer.from(b.subarray(8, 12)).toString() === 'WEBP'
  )
    return 'webp';
  const head = Buffer.from(b.subarray(0, 512)).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml') || head.includes('<svg')) return 'svg';
  return null;
}

const fail = (reason: string): never => {
  throw new ValidationError({ logo: [reason] });
};

export type ProcessedLogo = { body: Uint8Array; contentType: 'image/png'; hash: string };

/**
 * Checks the claimed MIME type and file name against the real bytes, then decodes and re-encodes to
 * PNG (no metadata) at no more than 512 px. Throws ValidationError on `logo` with a reason code.
 */
export async function processLogo(file: {
  name: string;
  type: string;
  bytes: Uint8Array;
}): Promise<ProcessedLogo> {
  if (file.bytes.byteLength === 0) fail('empty');
  if (file.bytes.byteLength > LOGO_MAX_BYTES) fail('too_big');
  const kind = sniff(file.bytes);
  if (kind === 'svg') fail('svg_not_allowed');
  if (!kind) fail('unsupported_type');
  const real = TYPES[kind as Kind];
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (file.type !== real.mime) fail('mime_mismatch');
  if (!(real.exts as readonly string[]).includes(ext)) fail('extension_mismatch');

  try {
    const meta = await sharp(file.bytes, {
      limitInputPixels: LOGO_MAX_INPUT_PIXELS ** 2
    }).metadata();
    if (!meta.width || !meta.height) return fail('unreadable');
    if (meta.width > LOGO_MAX_INPUT_PIXELS || meta.height > LOGO_MAX_INPUT_PIXELS)
      return fail('dimensions_too_big');
    const out = await sharp(file.bytes, { limitInputPixels: LOGO_MAX_INPUT_PIXELS ** 2 })
      .rotate()
      .resize(LOGO_OUTPUT_PX, LOGO_OUTPUT_PX, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return {
      body: new Uint8Array(out),
      contentType: 'image/png',
      hash: createHash('sha256').update(out).digest('hex').slice(0, 12)
    };
  } catch (e) {
    if (e instanceof ValidationError) throw e;
    return fail('unreadable');
  }
}

/** Storage key under the tenant prefix. The hash makes a replaced logo a new URL. */
export const logoKey = (tenantId: string, hash: string) =>
  `tenants/${tenantId}/branding/logo-${hash}.png`;

export const isLogoKey = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.startsWith('tenants/');
