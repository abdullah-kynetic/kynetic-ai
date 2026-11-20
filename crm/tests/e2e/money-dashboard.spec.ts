import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function ready(page: Page, path: string) {
  await page.goto(path);
  const create = page.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await create.isVisible()) {
    await create.click();
    await page.goto(path);
  }
}

test('Money overview shows MRR, collected, outstanding and the trend chart', async ({
  adminPage: page
}) => {
  await ready(page, '/admin/money');
  const tiles = page.getByRole('list', { name: 'Revenue in numbers' });
  await expect(tiles.getByRole('listitem')).toHaveCount(4);
  for (const label of ['MRR', 'Collected this month', 'Outstanding', 'Net this month'])
    await expect(tiles).toContainText(label);
  await expect(tiles.getByRole('listitem').first()).toContainText('$');
  await expect(page.getByRole('region', { name: 'Six-month revenue trend' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Outstanding invoices' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recurring revenue by client' })).toContainText(
    '/ month'
  );
});

test('Finance, Billing and Invoices tabs render real data in tables', async ({
  adminPage: page
}) => {
  await ready(page, '/admin/money/finance');
  await expect(page.getByRole('list', { name: 'This month (Pacific)' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Monthly revenue table' })).toBeVisible();
  await page.goto('/admin/money/billing');
  await expect(page.getByRole('region', { name: 'Agreed draft terms' })).toContainText('/ month');
  await page.goto('/admin/money/invoices');
  const table = page.getByRole('region', { name: 'Invoices table' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('row').filter({ hasText: 'Past due' }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Paid', exact: true }).click();
  await expect(page).toHaveURL(/status=paid/);
  await expect(table.getByRole('row').filter({ hasText: 'Past due' })).toHaveCount(0);
  await expect(table.getByRole('row').filter({ hasText: 'Paid' }).first()).toBeVisible();
});
