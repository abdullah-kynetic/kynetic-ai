import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processLogo } from '@/server/branding/logo';

const png = (w = 40, h = 20) =>
  sharp({ create: { width: w, height: h, channels: 4, background: '#2563eb' } })
    .png()
    .toBuffer();
const file = (bytes: Uint8Array, name = 'logo.png', type = 'image/png') => ({ name, type, bytes });
const reason = async (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e) => e.fieldErrors?.logo?.[0]
  );

describe('F-39 logo upload (SEC-T-31)', () => {
  it('accepts a PNG and re-encodes it', async () => {
    const out = await processLogo(file(await png()));
    expect(out.contentType).toBe('image/png');
    expect((await sharp(out.body).metadata()).width).toBe(40);
  });

  it('strips metadata and caps size at 512 px', async () => {
    const big = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: '#fff' }
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'x' } } })
      .toBuffer();
    const out = await processLogo(file(big, 'a.jpg', 'image/jpeg'));
    const meta = await sharp(out.body).metadata();
    expect(meta.width).toBe(512);
    expect(meta.exif).toBeUndefined();
  });

  it('rejects SVG, even renamed or relabelled', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'
    );
    expect(await reason(processLogo(file(svg, 'l.svg', 'image/svg+xml')))).toBe('svg_not_allowed');
    expect(await reason(processLogo(file(svg, 'l.png', 'image/png')))).toBe('svg_not_allowed');
  });

  it('rejects a MIME or extension that does not match the bytes', async () => {
    const b = await png();
    expect(await reason(processLogo(file(b, 'l.png', 'image/jpeg')))).toBe('mime_mismatch');
    expect(await reason(processLogo(file(b, 'l.jpg', 'image/png')))).toBe('extension_mismatch');
  });

  it('rejects oversize, empty, non-image and corrupt files', async () => {
    expect(await reason(processLogo(file(new Uint8Array(1_048_577))))).toBe('too_big');
    expect(await reason(processLogo(file(new Uint8Array())))).toBe('empty');
    expect(await reason(processLogo(file(new TextEncoder().encode('hello'))))).toBe(
      'unsupported_type'
    );
    const bad = Buffer.concat([(await png()).subarray(0, 40)]);
    expect(await reason(processLogo(file(bad)))).toBe('unreadable');
  });
});
