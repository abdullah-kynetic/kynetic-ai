import { expect, test } from '@playwright/test';

test('F-52: shell loads and the root redirects to the dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' }).first()).toBeVisible();
});

test('F-52: starter demo routes are gone', async ({ request }) => {
  for (const path of ['/dashboard/kanban', '/dashboard/chat', '/auth/sign-in', '/api/users']) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
  }
});

test('M0-21: security headers are set and the CSP blocks nothing the shell needs', async ({
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
  await expect(page.getByRole('heading', { name: 'Dashboard' }).first()).toBeVisible();
  expect(violations).toEqual([]);
});

test('M0-21: a state-changing request without Origin is refused', async ({ request }) => {
  const res = await request.post('/api/health');
  expect(res.status()).toBe(403);
  expect((await res.json()).error.code).toBe('FORBIDDEN');
});
