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
