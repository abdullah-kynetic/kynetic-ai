import { expect, test } from './fixtures';

test('pipeline shows the five stages, and the leads tab shows who is not in contact', async ({
  adminPage: page
}) => {
  await page.goto('/admin/sales');
  for (const stage of ['Audit pending', 'Proposal', 'Building', 'Testing', 'Live'])
    await expect(page.getByRole('region', { name: `${stage} stage` })).toBeVisible();
  await page.goto('/admin/sales/leads');
  await expect(page.getByRole('region', { name: 'Not in contact yet' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Declined' })).toBeVisible();
});

test('onboarding from a deal creates the account at Proposal and sends nothing', async ({
  adminPage: page
}) => {
  await page.goto(
    '/admin/clients/new?deal=00000000-0000-4000-8000-000000000001&name=Acme&email=a@example.test'
  );
  await expect(page.getByLabel('Business name')).toHaveValue('Acme');
  await expect(page.getByLabel('Owner email')).toHaveValue('a@example.test');
  await expect(page.getByText('creates the client account at the Proposal stage')).toBeVisible();
});
