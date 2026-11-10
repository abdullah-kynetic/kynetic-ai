import { mkdir } from 'node:fs/promises';
import { test, expect } from './fixtures';

const shot = '../docs/screenshots/batch-4';

test('batch 4 agency tools, documents, and parked Retell', async ({
  adminPage,
  authenticatedPage,
  vaPage
}) => {
  test.setTimeout(180_000);
  await mkdir(shot, { recursive: true });
  await adminPage.setViewportSize({ width: 1440, height: 1000 });
  for (const page of [authenticatedPage, vaPage]) {
    await page.goto('/admin/agency/contracts');
    await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toHaveCount(0);
    await page.goto('/admin/agency/finance');
    await expect(page.getByRole('heading', { name: 'Finance', exact: true })).toHaveCount(0);
  }

  await adminPage.goto('/admin/agency/finance');
  const missing = adminPage.getByText('has not been created yet');
  if (await missing.isVisible())
    await adminPage.screenshot({ path: `${shot}/finance-workspace-missing.png`, fullPage: true });
  await adminPage.goto('/admin/agency');
  const setup = adminPage.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await setup.isVisible()) await setup.click();

  await adminPage.getByLabel('Name', { exact: true }).fill('Batch Four Prospect');
  await adminPage.getByLabel('Synthetic email').fill('batch-four@example.test');
  await adminPage.getByLabel('Synthetic phone (optional)').fill('+12025550188');
  await adminPage.getByLabel('State (required for dialer)').selectOption('CA');
  await adminPage.getByLabel('Lead source', { exact: true }).selectOption('outbound:cold_call');
  await adminPage.getByRole('button', { name: 'Add lead', exact: true }).click();
  await expect(adminPage.getByRole('region', { name: 'This month finance' })).toContainText(
    'Revenue'
  );
  await adminPage.screenshot({ path: `${shot}/agency-overview.png`, fullPage: true });

  await adminPage.goto('/admin/agency/contracts');
  await expect(adminPage.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible();
  const noContracts = adminPage.getByText('No contracts yet');
  if (await noContracts.isVisible())
    await adminPage.screenshot({ path: `${shot}/contracts-empty.png`, fullPage: true });
  const agreement = adminPage.getByRole('article').filter({ hasText: 'Batch 4 agreement' });
  if (!(await agreement.isVisible())) {
    await adminPage
      .getByLabel('Deal', { exact: true })
      .selectOption({ label: 'Batch Four Prospect' });
    await adminPage.getByLabel('Title', { exact: true }).fill('Batch 4 agreement');
    await adminPage.getByRole('button', { name: 'Create contract' }).click();
  }
  await expect(agreement).toBeVisible();
  await adminPage.screenshot({ path: `${shot}/contracts.png`, fullPage: true });

  await adminPage.goto('/admin/agency/finance?tab=expenses');
  const noExpenses = adminPage.getByText('No expenses yet');
  if (await noExpenses.isVisible())
    await adminPage.screenshot({ path: `${shot}/finance-expenses-empty.png`, fullPage: true });
  const addExpense = adminPage
    .locator('form')
    .filter({ has: adminPage.getByRole('button', { name: 'Add expense' }) });
  if ((await adminPage.locator('input[name="vendor"]').count()) === 1) {
    await addExpense.getByLabel('Date', { exact: true }).fill('2026-11-04');
    await addExpense.getByLabel('Vendor', { exact: true }).fill('Print shop');
    await addExpense.getByLabel('Category', { exact: true }).fill('materials');
    await addExpense.getByLabel('Amount in USD', { exact: true }).fill('12.50');
    await addExpense.getByRole('button', { name: 'Add expense' }).click();
  }
  await expect(adminPage.locator('input[name="vendor"]').first()).toHaveValue('Print shop');
  await adminPage.screenshot({ path: `${shot}/finance-expenses.png`, fullPage: true });
  await adminPage.goto('/admin/agency/finance');
  await expect(adminPage.getByRole('heading', { name: 'Finance', exact: true })).toBeVisible();
  await adminPage.screenshot({ path: `${shot}/finance-revenue.png`, fullPage: true });

  await adminPage.goto('/admin/agency/dialer');
  await expect(adminPage.getByRole('heading', { name: 'Human dialer', exact: true })).toBeVisible();
  await expect(adminPage.getByLabel('Callback date (Pacific)')).toBeVisible();
  await adminPage.screenshot({ path: `${shot}/dialer.png`, fullPage: true });

  await adminPage.goto('/admin/agency/campaigns');
  await expect(
    adminPage.getByRole('heading', { name: 'Agency campaigns', exact: true })
  ).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Simulate step' })).toHaveCount(0);
  await adminPage.screenshot({ path: `${shot}/campaigns.png`, fullPage: true });

  await adminPage.goto('/admin/agency/billing');
  await expect(adminPage.getByRole('button', { name: 'Simulate payment failed' })).toHaveCount(0);
  await adminPage.screenshot({ path: `${shot}/billing.png`, fullPage: true });

  await adminPage.goto('/admin/agency/proposals');
  await adminPage.getByLabel('Agency deal').selectOption({ label: 'Batch Four Prospect' });
  await adminPage.getByRole('button', { name: 'Open or create draft' }).click();
  await adminPage.getByLabel('Problem').fill('Leads sit overnight.');
  await adminPage.getByRole('button', { name: 'Save draft' }).click();
  await expect(adminPage.getByRole('status')).toHaveText('Draft saved.');
  await adminPage.getByRole('link', { name: 'Preview saved draft' }).click();
  await expect(adminPage.getByText('Leads sit overnight.')).toBeVisible();
  await expect(adminPage.getByText('Pricing to be confirmed')).toBeVisible();
  const href = await adminPage.getByRole('link', { name: 'Download PDF' }).getAttribute('href');
  const pdf = await adminPage.request.get(href ?? '');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  await adminPage.screenshot({ path: `${shot}/proposal-preview.png`, fullPage: true });

  const tenant = '11111111-1111-4111-8111-111111111111';
  await adminPage.goto(`/admin/clients/${tenant}/documents`);
  await expect(adminPage.getByRole('heading', { name: 'Client documents' })).toBeVisible();
  await adminPage.screenshot({ path: `${shot}/documents.png`, fullPage: true });
  await adminPage.goto(`/admin/clients/${tenant}/imports`);
  await expect(adminPage.getByText('.xlsx', { exact: false })).toBeVisible();
  await adminPage.screenshot({ path: `${shot}/imports.png`, fullPage: true });
  await adminPage.goto(`/admin/clients/${tenant}/alex`);
  await expect(adminPage.locator('select#provider option[value="retell"]')).toHaveCount(0);
  await expect(adminPage.locator('select#provider option[value="elevenlabs"]')).toHaveCount(1);
  await adminPage.screenshot({ path: `${shot}/alex.png`, fullPage: true });
});
