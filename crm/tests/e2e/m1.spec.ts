import { expect, test } from './fixtures';

test('owner can browse contacts, companies and custom fields', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/dashboard/contacts');
  await expect(authenticatedPage.getByRole('link', { name: 'Contact a' })).toBeVisible();

  await authenticatedPage.goto('/dashboard/companies');
  await expect(authenticatedPage.getByText('Company a', { exact: true })).toBeVisible();

  await authenticatedPage.goto('/dashboard/settings/custom-fields');
  await expect(authenticatedPage.getByText('Custom fields', { exact: true }).first()).toBeVisible();
  await expect(authenticatedPage.getByText('Roof age', { exact: true })).toBeVisible();
});
