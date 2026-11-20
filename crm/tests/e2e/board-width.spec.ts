import { test, expect } from './fixtures';

// The Clients and Sales boards scroll inside their own frame; the page itself must never widen.
test('admin boards do not widen the page at 1000px', async ({ adminPage }) => {
  await adminPage.setViewportSize({ width: 1000, height: 800 });
  for (const path of ['clients', 'sales']) {
    await adminPage.goto(`/admin/${path}`);
    await expect(adminPage.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await adminPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      `${path} page overflow`
    ).toBe(true);
  }
});
