import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('F-52: starter demo routes are gone', async ({ request }) => {
  for (const path of ['/dashboard/kanban', '/dashboard/chat', '/api/users']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
  }
});

// M0-24: base components on the test-only gallery (COMPONENT_GALLERY=1 in playwright.config.ts).
for (const mode of ['light', 'dark'] as const) {
  test(`M0-24: base components have no axe violations (${mode})`, async ({ page }) => {
    await page.goto('/dev/components');
    if (mode === 'dark') {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
    }
    await page.getByRole('button', { name: 'Error toast' }).click();
    await page.getByRole('button', { name: 'Open dialog' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    ).toEqual([]);
  });
}

test('M0-24: focus ring shows on keyboard focus and Esc closes the dialog', async ({ page }) => {
  await page.goto('/dev/components');
  await page.getByRole('button', { name: 'Open dialog' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open dialog' })).toBeFocused();
  const ring = await page
    .getByRole('button', { name: 'Open dialog' })
    .evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).not.toBe('none');
});

test('M0-21: security headers are set and the CSP blocks nothing the dashboard needs', async ({
  page
}) => {
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/content security policy/i.test(m.text())) violations.push(m.text());
  });
  const res = await page.goto('/dashboard');
  const h = res!.headers();
  expect(h['content-security-policy']).toMatch(/script-src [^;]*'nonce-[^']+'/);
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['strict-transport-security']).toContain('max-age=');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(violations).toEqual([]);
});

test('M0-21: a state-changing request without Origin is refused', async ({ request }) => {
  const res = await request.post('/api/health');
  expect(res.status()).toBe(403);
  expect((await res.json()).error.code).toBe('FORBIDDEN');
});
