import { expect, test } from './fixtures';

test('owner can merge a duplicate contact into the selected survivor', async ({
  authenticatedPage
}) => {
  await authenticatedPage.goto('/dashboard/contacts');
  await authenticatedPage.getByRole('link', { name: /^Contact a$/i }).click();
  await authenticatedPage.waitForURL(/\/dashboard\/contacts\/[^/]+$/);
  await expect(authenticatedPage.getByText('Merge duplicate', { exact: true })).toBeVisible();
  await authenticatedPage
    .getByRole('combobox', { name: 'Duplicate contact' })
    .selectOption({ label: 'Duplicate — +15555550999' });
  await authenticatedPage.getByRole('button', { name: 'Merge into this contact' }).click();
  await expect(authenticatedPage.getByText('No other live contacts.')).toBeVisible();
});
