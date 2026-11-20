import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// The tests share one synthetic workspace and its leads, so they run one after another.
test.describe.configure({ mode: 'serial' });

// [name, path, area (the page's one h1), page title (h2 under the area), pill tab label]
const PAGES = [
  ['dialer', '/admin/prospecting/dialer', 'Prospecting', 'Human dialer', 'Human dialer'],
  ['inbox', '/admin/sales/inbox', 'Sales', 'Agency inbox', 'Inbox'],
  ['campaigns', '/admin/prospecting/campaigns', 'Prospecting', 'Agency campaigns', 'Campaigns'],
  ['proposals', '/admin/sales/proposals', 'Sales', 'Proposal drafts', 'Proposals'],
  ['contracts', '/admin/sales/contracts', 'Sales', 'Contracts', 'Contracts']
] as const;

async function withLeads(page: Page) {
  await page.goto('/admin/agency');
  const create = page.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await create.isVisible()) {
    await create.click();
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  }
  if ((await page.getByRole('listitem').filter({ hasText: 'Shot Prospect A' }).count()) === 0) {
    for (const [name, email, phone] of [
      ['Shot Prospect A', 'shot-a@example.test', '+12025550123'],
      ['Shot Prospect B', 'shot-b@example.test', '+12025550124']
    ]) {
      await page.getByLabel('Name', { exact: true }).fill(name);
      await page.getByLabel('Synthetic email').fill(email);
      await page.getByLabel('Synthetic phone (optional)').fill(phone);
      await page.getByLabel('State (required for dialer)').selectOption('TX');
      await page.locator('#source').selectOption('outbound:cold_call');
      await page.getByRole('button', { name: 'Add lead', exact: true }).click();
      // Other specs share this workspace; a duplicate phone or email is refused, which is fine here.
      await page.waitForTimeout(500);
      await page.goto('/admin/agency');
    }
  }
}

test('Sales pages: every page keeps its heading and the pill tab bar', async ({
  adminPage: page
}) => {
  await page.goto('/admin/agency');
  const create = page.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await create.isVisible()) {
    await create.click();
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  }
  for (const [, path, area, title, tab] of PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: area, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: `${area} pages` }).locator('[aria-current=page]')
    ).toHaveText(tab);
  }
});

test('Dialer: next lead shows status pills with words', async ({ adminPage: page }) => {
  await withLeads(page);
  await page.goto('/admin/prospecting/dialer');
  await expect(page.getByText('DNC check: clear')).toBeVisible();
  await expect(page.getByText(/\d+ eligible/)).toBeVisible();
});

test('Sales screenshots', async ({ adminPage: page }) => {
  const prefix = process.env.SHOT_PREFIX;
  test.skip(!prefix, 'screenshots only when SHOT_PREFIX is set');
  await withLeads(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, path] of PAGES) {
      await page.goto(path);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${prefix}-sales-${name}-${width}.png`, fullPage: true });
    }
  }
});
