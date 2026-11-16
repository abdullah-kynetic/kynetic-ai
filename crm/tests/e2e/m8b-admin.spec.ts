import { expect, test } from './fixtures';

test('F-53/F-54 admin all-clients table shows synthetic tenants and health thresholds', async ({
  adminPage
}) => {
  await adminPage.goto('/admin/clients');
  await expect(adminPage.getByRole('heading', { name: 'All clients' })).toBeVisible();
  await expect(adminPage.getByText(/green ≥70, yellow ≥40, red <40/)).toBeVisible();
  await expect(adminPage.getByRole('row').filter({ hasText: 'Synthetic Brand Co' })).toContainText(
    '·'
  );
  await expect(adminPage.getByRole('row').filter({ hasText: 'Tenant C' })).toBeVisible();
  // The synthetic Kynetic agency tenant exists once the agency specs have run; it is not a client row.
  // Other specs onboard clients (E2E ...) into the same database, so only the seeded rows are counted.
  await expect(
    adminPage.getByRole('row').filter({ hasNotText: /Kynetic AI \(synthetic\)|E2E / })
  ).toHaveCount(4);
});

test('phase 7 client list keeps view-as available to admin and VA and old lists redirect', async ({
  adminPage,
  vaPage
}) => {
  for (const page of [adminPage, vaPage]) {
    await page.goto('/admin/clients');
    await expect(page.getByRole('heading', { name: 'All clients', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();
  }
  await expect(
    adminPage.locator('#main-content').getByRole('link', { name: 'Onboard a client', exact: true })
  ).toBeVisible();
  await adminPage.goto('/admin');
  await expect(adminPage).toHaveURL(/\/admin$/);
  for (const oldPath of ['/admin/portals', '/admin/view-as']) {
    await adminPage.goto(oldPath);
    await expect(adminPage).toHaveURL(/\/admin\/clients$/);
  }
});

test('F-28/F-62 admin operations shows integration failures and reviews a flagged call', async ({
  adminPage
}) => {
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
  const jobs = adminPage
    .getByRole('region')
    .filter({ has: adminPage.getByRole('heading', { name: 'Recent jobs' }) });
  await expect(jobs.getByText('webhook.process')).toBeVisible();
});

test('F-58 admin updates client Alex configuration and creates a prompt version', async ({
  adminPage
}) => {
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111/alex');
  await expect(adminPage.getByRole('heading', { name: 'Alex configuration' })).toBeVisible();
  await expect(adminPage.getByText(/prompt version 1/)).toBeVisible();
  await adminPage.getByLabel('Greeting').fill('Synthetic revised greeting');
  await adminPage.getByLabel('New prompt (optional)').fill('Synthetic admin prompt version');
  await adminPage.getByRole('button', { name: 'Save Alex settings' }).click();
  await expect(adminPage.getByText(/prompt version 2/)).toBeVisible();
  await expect(adminPage.getByLabel('Greeting')).toHaveValue('Synthetic revised greeting');
});

test('phase 7 client page exposes tabs without changing subpage addresses', async ({
  adminPage
}) => {
  await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111');
  for (const label of ['Overview', 'Systems', 'Alex', 'Reports', 'Documents', 'Billing', 'Setup']) {
    await expect(adminPage.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(adminPage.getByRole('link', { name: 'Offboard', exact: true })).toBeVisible();
  await adminPage.getByRole('link', { name: 'Systems', exact: true }).click();
  await expect(adminPage).toHaveURL(/\/admin\/clients\/[^/]+\/systems$/);
});

test('phase 7 Today shows all blocks to admin and only permitted blocks to VA', async ({
  adminPage,
  vaPage
}) => {
  await adminPage.goto('/admin');
  for (const heading of [
    'Needs you now',
    'Sales today',
    'Clients needing attention',
    'Support',
    'Daily summary'
  ]) {
    await expect(adminPage.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await vaPage.goto('/admin');
  await expect(
    vaPage.getByRole('heading', { name: 'Clients needing attention', exact: true })
  ).toBeVisible();
  await expect(vaPage.getByRole('heading', { name: 'Support', exact: true })).toBeVisible();
  await expect(vaPage.getByRole('heading', { name: 'Sales today', exact: true })).toHaveCount(0);
  await expect(vaPage.getByRole('heading', { name: 'Daily summary', exact: true })).toHaveCount(0);
});

test('phase 7 gives the operations pages distinct names and hides DEV blocks', async ({
  adminPage
}) => {
  await adminPage.goto('/admin/operations');
  await expect(
    adminPage.getByRole('heading', { name: 'Jobs and integrations', exact: true })
  ).toBeVisible();
  await adminPage.goto('/admin/agency/ops');
  await expect(
    adminPage.getByRole('heading', { name: 'Sales settings', exact: true })
  ).toBeVisible();
  await expect(
    adminPage.getByRole('heading', { name: 'DEV integration draft', exact: true })
  ).toBeHidden();
  await expect(
    adminPage.getByRole('heading', { name: 'Agency DEV lead secret', exact: true })
  ).toBeHidden();
  await expect(adminPage.getByLabel('DEV lead webhook URL', { exact: true })).toBeHidden();
  await expect(adminPage.getByLabel('Inactive DEV workflow name', { exact: true })).toBeHidden();
});
