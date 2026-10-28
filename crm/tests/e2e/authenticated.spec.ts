import { expect, test } from './fixtures';

test('signed-in owner can open the CRM dashboard', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage).toHaveURL(/\/dashboard$/);
  await expect(authenticatedPage.getByRole('main')).toBeVisible();
});
