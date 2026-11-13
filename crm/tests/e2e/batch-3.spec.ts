import { mkdir } from 'node:fs/promises';
import { expect, test } from './fixtures';

const shots = '../docs/screenshots/batch-3';

test.beforeAll(async () => {
  await mkdir(shots, { recursive: true });
});

test('usage page lists clients and downloads a csv', async ({
  adminPage,
  vaPage,
  authenticatedPage
}) => {
  await adminPage.goto('/admin/usage');
  await expect(adminPage.getByRole('heading', { name: 'Usage' })).toBeVisible();
  await expect(adminPage.getByRole('row').filter({ hasText: 'Synthetic Brand Co' })).toBeVisible();
  await expect(adminPage.getByRole('row').filter({ hasText: 'Tenant C' })).toContainText('0.0');
  await adminPage.screenshot({ path: `${shots}/usage.png`, fullPage: true });
  const month = new Date().toISOString().slice(0, 7);
  const csv = await adminPage.request.get(`/admin/usage/export?month=${month}`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('Synthetic Brand Co');
  await vaPage.goto('/admin/usage');
  await expect(vaPage.getByRole('heading', { name: 'Usage' })).toBeVisible();
  await vaPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111');
  await expect(vaPage.getByRole('button', { name: 'Save cap' })).toHaveCount(0);
  const refused = await authenticatedPage.goto('/admin/usage');
  expect(refused?.status()).toBe(403);
});

test('operations pause needs a reason and a confirm to resume', async ({ adminPage, vaPage }) => {
  await adminPage.goto('/admin/operations');
  await expect(adminPage.getByText('Env: off · Portal: running')).toBeVisible();
  await adminPage.getByLabel('Reason').fill('Synthetic maintenance window');
  await adminPage.getByRole('button', { name: 'Pause all calls and texts' }).click();
  await expect(adminPage.getByText('Env: off · Portal: paused')).toBeVisible();
  await adminPage.screenshot({ path: `${shots}/operations-paused.png`, fullPage: true });
  await adminPage.getByRole('button', { name: 'Resume calls and texts' }).click();
  await expect(adminPage.getByRole('dialog')).toBeVisible();
  await adminPage.getByRole('button', { name: 'Yes, resume' }).click();
  await expect(adminPage.getByText('Env: off · Portal: running')).toBeVisible();
  await vaPage.goto('/admin/operations');
  await expect(vaPage.getByRole('button', { name: 'Pause all calls and texts' })).toHaveCount(0);
});

test.describe('offboarding', () => {
  test.describe.configure({ mode: 'serial' });

  test('asks for the slug and shows an empty export list', async ({ adminPage }) => {
    await adminPage.goto('/admin/clients/33333333-3333-4333-8333-333333333333/offboard');
    await expect(adminPage.getByRole('heading', { name: 'Offboard Tenant C' })).toBeVisible();
    await expect(adminPage.getByText('No export yet.')).toBeVisible();
    await adminPage.screenshot({ path: `${shots}/offboard-empty.png`, fullPage: true });
    await adminPage.getByLabel('Client slug').fill('wrong-slug');
    await adminPage.getByRole('button', { name: 'Offboard client' }).click();
    await expect(adminPage.getByText('Nothing was changed.')).toBeVisible();
  });

  test('offboards after the slug matches', async ({ adminPage }) => {
    await adminPage.goto('/admin/clients/33333333-3333-4333-8333-333333333333/offboard');
    await adminPage.getByLabel('Client slug').fill('tenant-c');
    await adminPage.getByRole('button', { name: 'Offboard client' }).click();
    await expect(adminPage.getByText('Offboarding is recorded.')).toBeVisible();
    await adminPage.screenshot({ path: `${shots}/offboard-done.png`, fullPage: true });
  });

  test('refuses a client and a VA', async ({ authenticatedPage, vaPage }) => {
    const client = await authenticatedPage.goto(
      '/admin/clients/33333333-3333-4333-8333-333333333333/offboard'
    );
    expect(client?.status()).toBe(403);
    const va = await vaPage.goto('/admin/clients/33333333-3333-4333-8333-333333333333/offboard');
    expect(va?.status()).toBe(403);
  });
});

test('production has no dev lead hook, refuses open personas, and a live gallery button', async ({
  request,
  adminPage
}) => {
  const hook = await request.post('/api/hooks/leads/dev/tenant-a', {
    data: { synthetic: true }
  });
  expect(hook.status()).toBe(404);
  const open = await request.get('/open/owner');
  expect(open.status()).toBe(404);
  await adminPage.goto('/dev/components');
  await expect(adminPage.getByRole('button', { name: 'Demo only' })).toBeDisabled();
  await adminPage.screenshot({ path: `${shots}/gallery-demo-only.png`, fullPage: true });
});
