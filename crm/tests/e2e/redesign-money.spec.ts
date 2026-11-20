import { expect, test } from './fixtures';

test.describe.configure({ mode: 'serial' });

async function workspace(page: import('@playwright/test').Page) {
  await page.goto('/admin/agency');
  const create = page.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await create.isVisible()) {
    await create.click();
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible();
  }
}

test('Usage shows totals and keeps the table region', async ({ adminPage: page }) => {
  await page.goto('/admin/usage');
  await expect(page).toHaveURL(/\/admin\/money\/usage$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Usage' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Usage by client' })).toBeVisible();
  await expect(page.getByText('Provider cost', { exact: true }).first()).toBeVisible();
});

test('Finance keeps its tabs and shows the month totals', async ({ adminPage: page }) => {
  await workspace(page);
  await page.goto('/admin/money/finance');
  await expect(page.getByRole('heading', { level: 1, name: 'Money' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'This month (Pacific)' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Finance tabs' }).locator('[aria-current=page]')
  ).toHaveText('Revenue');
});

test('Money screenshots', async ({ adminPage: page }) => {
  const prefix = process.env.SHOT_PREFIX;
  test.skip(!prefix, 'screenshots only when SHOT_PREFIX is set');
  await workspace(page);
  const pages = [
    ['usage', '/admin/usage'],
    ['finance', '/admin/agency/finance'],
    ['finance-expenses', '/admin/agency/finance?tab=expenses'],
    ['billing', '/admin/agency/billing']
  ];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, path] of pages) {
      await page.goto(path);
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${prefix}-money-${name}-${width}.png`, fullPage: true });
    }
  }
});
