import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { R2Storage } from '@/server/adapters/storage/r2';
import { logoKey, processLogo } from '@/server/branding/logo';
import { expect, test } from './fixtures';

test.use({ trace: 'off' });

test('F-39 uploads and downloads a synthetic tenant logo through the authorized R2 test bucket', async ({
  authenticatedPage
}) => {
  // Needs the authorized R2 test bucket and its credentials, which CI does not have; run it where they exist.
  test.skip(
    !process.env.STORAGE_ENDPOINT || !process.env.STORAGE_ACCESS_KEY_ID,
    'R2 test bucket credentials are not configured in this environment'
  );
  if (process.env.STORAGE_BUCKET !== 'kynetic-portal-test') {
    throw new Error('Refusing R2 logo E2E: STORAGE_BUCKET must equal kynetic-portal-test');
  }
  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 logo E2E endpoint or credentials are missing');
  }
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const storage = new R2Storage({
    endpoint,
    bucket: 'kynetic-portal-test',
    credentials: { accessKeyId, secretAccessKey }
  });
  const [r, g, b] = randomBytes(3);
  const png = await sharp({
    create: { width: 12, height: 12, channels: 4, background: { r, g, b, alpha: 1 } }
  })
    .png()
    .toBuffer();
  const processed = await processLogo({
    name: 'synthetic-test.png',
    type: 'image/png',
    bytes: png
  });
  const key = logoKey(tenantId, processed.hash);

  try {
    await authenticatedPage.goto('/dashboard/settings/branding');
    await authenticatedPage.locator('input[name="logo"]').setInputFiles({
      name: 'synthetic-test.png',
      mimeType: 'image/png',
      buffer: png
    });
    await authenticatedPage.getByRole('button', { name: 'Save branding' }).click();
    await expect(authenticatedPage.getByRole('status')).toHaveText('Branding saved.');

    const objects = await storage.list(`tenants/${tenantId}/branding/`);
    expect(objects.map((object) => object.key)).toContain(key);
    const stored = await storage.get(key);
    expect(stored?.contentType).toBe('image/png');
    expect(stored?.body).toEqual(processed.body);

    await authenticatedPage.reload();
    const currentLogo = authenticatedPage.getByRole('img', { name: 'Current logo' });
    await expect(currentLogo).toBeVisible();
    await expect
      .poll(() => currentLogo.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    await storage.remove(key);
    expect(
      (await storage.list(`tenants/${tenantId}/branding/`)).map((object) => object.key)
    ).not.toContain(key);
  }
});
