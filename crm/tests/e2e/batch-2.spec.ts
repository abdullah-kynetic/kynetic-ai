import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from './fixtures';

const dir = join(process.cwd(), '../docs/screenshots/batch-2');

async function shot(page: import('@playwright/test').Page, name: string) {
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
}

test('client workspace pages render with data and empty states', async ({
  authenticatedPage,
  adminPage
}) => {
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(authenticatedPage.getByText('Speed to lead')).toBeVisible();
  await expect(authenticatedPage.getByText('Booking rate')).toBeVisible();
  await expect(authenticatedPage.getByText('Booking guarantee')).toBeVisible();
  await shot(authenticatedPage, 'dashboard');

  await authenticatedPage.goto('/dashboard?from=2020-01-01&to=2020-01-07');
  await expect(authenticatedPage.getByText('No activity in this range.')).toBeVisible();
  await expect(authenticatedPage.getByText('No calls yet')).toBeVisible();
  await shot(authenticatedPage, 'dashboard-empty-range');

  await authenticatedPage.goto('/dashboard?from=2026-12-01&to=2026-11-01');
  await expect(authenticatedPage.getByRole('status')).toContainText('not valid');
  await shot(authenticatedPage, 'dashboard-invalid-range');

  await authenticatedPage.goto('/dashboard/appointments?view=month');
  await expect(authenticatedPage.getByRole('heading', { name: 'Appointments' })).toBeVisible();
  await expect(authenticatedPage.getByLabel('Contact')).toBeVisible();
  await shot(authenticatedPage, 'appointments-month');

  await authenticatedPage.getByLabel('Contact').fill('Contact');
  await expect(authenticatedPage.getByRole('button', { name: /Contact a/ })).toBeVisible();
  await expect(authenticatedPage.getByRole('button', { name: /Contact b/ })).toHaveCount(0);
  await shot(authenticatedPage, 'appointments-contact-picker');

  await authenticatedPage.goto('/dashboard/appointments?view=week');
  await expect(authenticatedPage.getByRole('table')).toBeVisible();
  await shot(authenticatedPage, 'appointments-week');

  await authenticatedPage.goto('/dashboard/appointments?view=day');
  await shot(authenticatedPage, 'appointments-day');

  await authenticatedPage.goto('/dashboard/appointments?view=week&date=1999-01-04');
  await expect(authenticatedPage.getByText('No appointments in this window.')).toBeVisible();
  await shot(authenticatedPage, 'appointments-empty');

  await authenticatedPage.goto('/dashboard/settings/automations');
  await expect(authenticatedPage.getByRole('heading', { name: 'Automations' })).toBeVisible();
  await expect(authenticatedPage.getByText('Runs in the last 30 days').first()).toBeVisible();
  await authenticatedPage.getByRole('button', { name: 'View history' }).first().click();
  await expect(authenticatedPage.getByRole('dialog')).toBeVisible();
  await shot(authenticatedPage, 'automations-history');

  await authenticatedPage.goto('/dashboard/pipeline');
  await expect(authenticatedPage.getByRole('search', { name: 'Filter deals' })).toBeVisible();
  await expect(authenticatedPage.getByRole('heading', { name: 'Roof replacement' })).toBeVisible();
  await shot(authenticatedPage, 'pipeline');
  await authenticatedPage.goto('/dashboard/pipeline?source=not-a-real-source');
  await expect(authenticatedPage.getByRole('heading', { name: 'Roof replacement' })).toHaveCount(0);
  await shot(authenticatedPage, 'pipeline-filtered');

  await authenticatedPage.goto('/dashboard/support');
  await expect(authenticatedPage.getByRole('heading', { name: 'Support' })).toBeVisible();
  await expect(authenticatedPage.getByRole('link', { name: 'Fixture request' })).toBeVisible();
  await shot(authenticatedPage, 'support');
  await authenticatedPage.getByRole('link', { name: 'Fixture request' }).click();
  await expect(
    authenticatedPage
      .getByText('No replies yet')
      .or(authenticatedPage.getByText('Synthetic support message.'))
  ).toBeVisible();
  await shot(authenticatedPage, 'support-thread');

  await authenticatedPage.goto('/dashboard/settings/alex');
  await authenticatedPage.locator('summary', { hasText: 'Request a change to Alex' }).click();
  await expect(authenticatedPage.getByLabel('What should Alex do differently?')).toBeVisible();
  await expect(authenticatedPage.getByText('The script itself stays with Kynetic.')).toBeVisible();
  await shot(authenticatedPage, 'alex-request');

  await authenticatedPage.goto('/terms/accept?next=https://evil.example');
  await expect(
    authenticatedPage.getByText('Draft wording. Counsel has not approved this text.')
  ).toBeVisible();
  await expect(authenticatedPage.locator('input[name="next"]')).toHaveValue('/dashboard');
  await shot(authenticatedPage, 'terms-accept');

  const refused = await authenticatedPage.goto('/admin/support');
  expect(refused?.status()).toBe(403);

  await adminPage.goto('/admin/support');
  await expect(adminPage.getByRole('heading', { name: 'Support requests' })).toBeVisible();
  await expect(adminPage.getByRole('link', { name: 'Alex change' })).toBeVisible();
  await shot(adminPage, 'admin-support');
  await adminPage.goto('/admin/support?category=system_request');
  await expect(adminPage.getByText('No support requests.')).toBeVisible();
  await shot(adminPage, 'admin-support-empty');
});
