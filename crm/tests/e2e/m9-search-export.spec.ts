import { expect, test } from './fixtures';

test('F-37 Cmd+K finds a contact by phone fragment', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard');
  await authenticatedPage.getByRole('button', { name: /Search/ }).click();
  const search = authenticatedPage.getByRole('combobox');
  await search.fill('5555550101');
  await expect(authenticatedPage.getByText('Contact a')).toBeVisible();
});

test('F-38 contacts CSV export downloads the current tenant view', async ({
  authenticatedPage
}) => {
  await authenticatedPage.goto('/dashboard/contacts');
  const downloadPromise = authenticatedPage.waitForEvent('download');
  await authenticatedPage.getByRole('link', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('contacts.csv');
});
