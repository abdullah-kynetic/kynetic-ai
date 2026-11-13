import { expect, test } from './fixtures';

// P4-6: a new client is created from one form, with the owner invite waiting for approval and the
// defaults already in place. No email goes out under e2e (no mail provider is connected).

test('admin onboards a client from one form; nothing is sent until the invite is approved', async ({
  adminPage: page
}) => {
  await page.goto('/admin/clients/new');
  await expect(page.getByRole('heading', { name: 'Onboard a client' })).toBeVisible();

  await page.getByLabel('Business name').fill('E2E Onboard Roofing');
  await page.getByLabel('Owner email').fill('owner@e2e-onboard.example.test');
  await page.getByLabel('Owner phone').fill('+15550100199');
  await page.getByLabel('Service area zip codes').fill('94110 94103');
  await page.getByRole('button', { name: 'Create client' }).click();

  // Created, with the draft invite and an explicit statement that nothing was sent.
  await expect(page.getByRole('status').first()).toContainText('e2e-onboard-roofing');
  await expect(page.getByRole('status').first()).toContainText(
    'Nothing has been sent to owner@e2e-onboard.example.test yet.'
  );
  await expect(page.getByText('Subject: Your E2E Onboard Roofing portal is ready')).toBeVisible();

  // Approving without a connected mail provider fails safely and says so.
  await page.getByRole('button', { name: 'Approve and send' }).click();
  await expect(page.getByText('Email delivery is not connected yet')).toBeVisible();

  // The setup checklist already exists: the form completed its own steps, the invite and go-live wait.
  await page.getByRole('link', { name: 'Open the setup checklist' }).click();
  await expect(page).toHaveURL(/\/admin\/clients\/[0-9a-f-]{36}\/checklist/);
  const body = page.locator('main');
  await expect(body).toContainText('Client account created');
  await expect(body).toContainText('Owner invited');
  await expect(body).toContainText('Business profile, hours and service area');
  await expect(body).toContainText('Go-live');
  await expect(body).toContainText('Voice agent configured');

  // The new client is in the all-clients table.
  await page.goto('/admin');
  await expect(page.getByRole('row').filter({ hasText: 'E2E Onboard Roofing' })).toBeVisible();
});

test('a second client cannot reuse the owner email or the web address', async ({
  adminPage: page
}) => {
  const fill = async (name: string, email: string, slug: string) => {
    await page.goto('/admin/clients/new');
    await page.getByLabel('Business name').fill(name);
    await page.getByLabel('Web address (optional)').fill(slug);
    await page.getByLabel('Owner email').fill(email);
    await page.getByLabel('Owner phone').fill('+15550100198');
    await page.getByRole('button', { name: 'Create client' }).click();
  };
  await fill('E2E Duplicate One', 'dup-owner@e2e-onboard.example.test', 'e2e-duplicate-one');
  await expect(page.getByRole('status').first()).toContainText('e2e-duplicate-one');

  await fill('E2E Duplicate Two', 'dup-owner@e2e-onboard.example.test', 'e2e-duplicate-two');
  await expect(page.getByText('already has an account or a pending invite')).toBeVisible();

  await fill('E2E Duplicate Three', 'other-owner@e2e-onboard.example.test', 'e2e-duplicate-one');
  await expect(page.getByText('A client with this web address already exists')).toBeVisible();
});
