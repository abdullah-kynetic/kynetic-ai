import { expect, test } from './fixtures';

test('F-53/F-54 admin all-clients table shows synthetic tenants and health thresholds', async ({ adminPage }) => {
  await adminPage.goto('/admin');
  await expect(adminPage.getByRole('heading', { name: 'All clients' })).toBeVisible();
  await expect(adminPage.getByText(/green ≥70, yellow ≥40, red <40/)).toBeVisible();
  await expect(adminPage.getByRole('row').filter({ hasText: 'Synthetic Brand Co' })).toContainText('·');
  await expect(adminPage.getByRole('row').filter({ hasText: 'Tenant C' })).toBeVisible();
  await expect(adminPage.getByRole('row')).toHaveCount(4);
});

test('F-28/F-62 admin operations shows integration failures and reviews a flagged call', async ({ adminPage }) => {
  await adminPage.goto('/admin/operations');
  await expect(adminPage.getByRole('heading', { name: 'Integration health' })).toBeVisible();
  await expect(adminPage.getByText('Synthetic integration failure')).toBeVisible();
  const review = adminPage.getByRole('listitem').filter({ hasText: 'Synthetic flagged reason' });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Mark reviewed' }).click();
  await expect(adminPage.getByText('No flagged calls waiting for review.')).toBeVisible();
  const failed = adminPage.getByRole('listitem').filter({ hasText: 'Synthetic webhook failure' });
  await expect(failed).toBeVisible();
  await failed.getByRole('button', { name: 'Replay failed event' }).click();
  await expect(adminPage.getByText('No failed webhooks.')).toBeVisible();
  const jobs = adminPage.getByRole('region').filter({ has: adminPage.getByRole('heading', { name: 'Recent jobs' }) });
  await expect(jobs.getByText('webhook.process')).toBeVisible();
});

test('F-58 admin updates client Alex configuration and creates a prompt version', async ({ adminPage }) => {
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/alex');
  await expect(adminPage.getByRole('heading', { name: 'Alex configuration' })).toBeVisible();
  await expect(adminPage.getByText(/prompt version 1/)).toBeVisible();
  await adminPage.getByLabel('Greeting').fill('Synthetic revised greeting');
  await adminPage.getByLabel('New prompt (optional)').fill('Synthetic admin prompt version');
  await adminPage.getByRole('button', { name: 'Save Alex settings' }).click();
  await expect(adminPage.getByText(/prompt version 2/)).toBeVisible();
  await expect(adminPage.getByLabel('Greeting')).toHaveValue('Synthetic revised greeting');
});
