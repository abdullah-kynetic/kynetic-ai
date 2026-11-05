import { expect, test } from './fixtures';

test('signed-in owner can open the CRM dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage).toHaveURL(/\/dashboard$/);
  await expect(authenticatedPage.getByRole('main')).toBeVisible();
});

test('sign-in page renders and anonymous admin requests get raw 401', async ({ page, request }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Work email', { exact: true })).toBeVisible();
  const response = await request.get('/admin', { maxRedirects: 0 });
  expect(response.status()).toBe(401);
});

test('verified non-admin cannot open admin, while verified admin can', async ({
  authenticatedPage,
  adminPage
}) => {
  expect(
    (await authenticatedPage.context().request.get('/admin', { maxRedirects: 0 })).status()
  ).toBe(403);
  await adminPage.goto('/admin');
  await expect(adminPage.getByRole('heading', { name: 'All clients', exact: true })).toBeVisible();
});
