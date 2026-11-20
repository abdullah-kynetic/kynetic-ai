import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

async function withWorkspace(page: Page) {
  await page.goto('/admin/agency');
  const create = page.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await create.isVisible()) {
    await create.click();
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  }
}

async function addLead(page: Page, name: string, email: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Synthetic email').fill(email);
  await page.getByRole('button', { name: 'Add lead', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible();
}

test('Prospecting: one h1, funnel tab, header action and the metrics keep their regions', async ({
  adminPage: page
}) => {
  await withWorkspace(page);
  await expect(page).toHaveURL(/\/admin\/prospecting$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Prospecting' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add a lead' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Prospecting pages' });
  await expect(nav.getByRole('link', { name: 'Funnel' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('region', { name: 'Seven-day agency rates' })).toContainText(
    'Last seven days'
  );
});

test('Prospecting screenshots', async ({ adminPage: page }) => {
  const prefix = process.env.SHOT_PREFIX;
  test.skip(!prefix, 'screenshots only when SHOT_PREFIX is set');
  await withWorkspace(page);
  if ((await page.getByRole('listitem').filter({ hasText: 'Shot Prospect A' }).count()) === 0) {
    await addLead(page, 'Shot Prospect A', 'shot-a@example.test');
    await addLead(page, 'Shot Prospect B', 'shot-b@example.test');
  }
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/admin/agency');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${prefix}-prospecting-${width}.png`, fullPage: true });
  }
});
