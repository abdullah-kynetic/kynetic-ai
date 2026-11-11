import { mkdir } from 'node:fs/promises';
import { expect, test } from './fixtures';

async function shot(page: import('@playwright/test').Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test('admin client overview, systems, templates, and requests render', async ({ adminPage }) => {
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111');
  await expect(adminPage.getByRole('heading', { name: 'Synthetic Brand Co' })).toBeVisible();
  await expect(adminPage.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(adminPage.getByRole('heading', { name: 'Booking guarantee' })).toBeVisible();
  await expect(adminPage.getByText('No pipeline yet.')).toHaveCount(0);
  await shot(adminPage, 'admin-client-overview');

  await adminPage.goto('/admin/clients/33333333-3333-4333-8333-333333333333');
  await expect(adminPage.getByText('No pipeline yet.')).toBeVisible();
  await expect(adminPage.getByText('No activity yet.')).toBeVisible();
  await shot(adminPage, 'admin-client-overview-empty');

  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/systems');
  await expect(adminPage.getByRole('heading', { name: /systems/i })).toBeVisible();
  await expect(
    adminPage.getByText('Every new lead gets a call back in under a minute')
  ).toBeVisible();
  await shot(adminPage, 'admin-system-settings');

  await adminPage.goto('/admin/templates');
  await expect(adminPage.getByRole('heading', { name: 'Template library' })).toBeVisible();
  await expect(
    adminPage.getByRole('heading', { name: 'Remodeling (bath and kitchen)' })
  ).toBeVisible();
  await expect(adminPage.getByText('Stage names are editable defaults.').first()).toBeVisible();
  await expect(adminPage.getByText('Coming soon').first()).toBeVisible();
  await expect(adminPage.getByRole('heading', { name: 'Reputation Engine' })).toBeVisible();
  await shot(adminPage, 'admin-template-library');

  await adminPage.goto('/admin/system-requests');
  await expect(adminPage.getByRole('heading', { name: 'System requests' })).toBeVisible();
  await shot(adminPage, 'admin-system-requests');

  await adminPage.goto('/admin/clients/new');
  await expect(
    adminPage.getByRole('option', { name: 'Remodeling (bath and kitchen)' })
  ).toBeAttached();
  await shot(adminPage, 'admin-onboarding-remodeling');
});

test('client my systems and the 30-day guarantee empty state render', async ({
  authenticatedPage
}) => {
  await authenticatedPage.goto('/dashboard/systems');
  await expect(authenticatedPage.getByRole('heading', { name: 'My systems' })).toBeVisible();
  await expect(
    authenticatedPage.getByText('Every new lead gets a call back in under a minute')
  ).toBeVisible();
  await expect(
    authenticatedPage.getByRole('button', { name: 'Request this' }).first()
  ).toBeVisible();
  await shot(authenticatedPage, 'client-my-systems');

  await authenticatedPage.goto('/dashboard');
  await expect(
    authenticatedPage.getByText('20% more booked appointments than last month')
  ).toBeVisible();
  await shot(authenticatedPage, 'client-dashboard-guarantee');
});
