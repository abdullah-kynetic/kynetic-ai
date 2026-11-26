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

test('Funnel dashboard shows counts, conversion and sources from seeded data', async ({
  adminPage: page
}) => {
  await ready(page, '/admin/prospecting');
  const tiles = page.getByRole('list', { name: 'Prospects per stage' });
  await expect(tiles.getByRole('listitem')).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Conversion funnel' })).toContainText(
    'of previous step'
  );
  await expect(page.getByRole('region', { name: 'Prospects by source' })).toContainText(
    'Google Maps'
  );
  await expect(page.getByRole('link', { name: 'Fully enriched', exact: true })).toBeVisible();
});

test('Lead tables search, filter and bulk-select; Move to Sales creates deals only', async ({
  adminPage: page
}) => {
  await ready(page, '/admin/prospecting/scraped');
  await page.getByText('Add a synthetic prospect').click();
  await page.getByLabel('Business name').fill('Bulk Move Alpha');
  await page.getByLabel('Synthetic email').fill('alpha@example.test');
  await page.getByLabel('Website').fill('https://alpha.example.test');
  await page.getByLabel('Synthetic phone').fill('+12025550131');
  await page.getByLabel('Owner name').fill('Alex Alpha');
  const saved = page.waitForResponse((r) => r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Add prospect' }).click();
  await saved;
  await page.waitForLoadState('networkidle');
  await page.getByText('Add a synthetic prospect').click();
  await page.getByLabel('Business name').fill('Bulk Move Beta');
  await page.getByLabel('Synthetic email').fill('beta@example.test');
  await page.getByLabel('Website').fill('https://beta.example.test');
  await page.getByLabel('Synthetic phone').fill('+12025550132');
  await page.getByLabel('Owner name').fill('Bea Beta');
  const savedBeta = page.waitForResponse((r) => r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Add prospect' }).click();
  await savedBeta;

  await page.goto('/admin/prospecting/fully-enriched');
  await page.getByLabel('Search prospects').fill('Bulk Move');
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Bulk Move Alpha' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Bulk Move Beta' })).toBeVisible();
  const move = page.getByRole('button', { name: /^Move to Sales/ });
  await expect(move).toBeDisabled();
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Select all prospects').check();
  await expect(move).toHaveText('Move to Sales (2)');
  await move.click();
  await expect(page.getByRole('status')).toContainText('Moved 2 to Sales');
  await expect(page.getByRole('row').filter({ hasText: 'Bulk Move Alpha' })).toHaveCount(0);

  // New deals are not in contact yet, so they wait on the Leads tab until an audit is booked.
  await page.goto('/admin/sales/leads');
  await expect(page.getByText('Bulk Move Alpha')).toBeVisible();
  await expect(page.getByText('Bulk Move Beta')).toBeVisible();
});

test('A prospect without an email is skipped with a reason', async ({ adminPage: page }) => {
  await ready(page, '/admin/prospecting/half-enriched');
  const row = page.getByRole('row').filter({ hasText: 'demo' }).nth(0);
  await expect(row).toBeVisible();
  await row.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^Move to Sales/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Needs an email first.' })).toBeVisible();
});

test('Empty filter result shows a message', async ({ adminPage: page }) => {
  await ready(page, '/admin/prospecting/scraped');
  await page.getByLabel('Search prospects').fill('zzzz-no-such-business');
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByText('No prospects match these filters.')).toBeVisible();
});
