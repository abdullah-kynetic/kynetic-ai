import { mkdir } from 'node:fs/promises';
import { expect, test } from './fixtures';

const screenshots = '../docs/screenshots/lane-a-a0';
test('F-01 F-49 charts and reports show data, empty states and stay within 390px', async ({
  authenticatedPage: page,
  browser
}) => {
  await mkdir(screenshots, { recursive: true });
  await page.goto('/dashboard?from=2026-09-01&to=2026-09-30');
  for (const name of ['Daily leads and bookings', 'Conversion funnel', 'Lead sources']) {
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  }
  const daily = page.getByRole('region', { name: 'Daily leads and bookings', exact: true });
  await daily.getByText('View daily data', { exact: true }).click();
  await expect(daily.getByRole('table')).toContainText('2026-09-10');
  await page.screenshot({ path: `${screenshots}/dashboard-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: `${screenshots}/dashboard-390.png`, fullPage: true });
  await page.goto('/dashboard?from=2020-01-01&to=2020-01-07');
  await expect(page.getByText('No activity in this range.', { exact: true })).toBeVisible();
  await expect(page.getByText('No funnel activity in this range.', { exact: true })).toBeVisible();
  await page.goto('/dashboard/reports/aaaaaaaa-1000-4000-8000-000000000001');
  await expect(page.getByText('Computed from daily metrics', { exact: true })).toBeVisible();
  await expect(page.locator('dl[aria-label="Report totals"]')).toContainText('$1,500');
  await expect(page.locator('dl[aria-label="Report totals"]')).toContainText('40%');
  await expect(page.getByText('Report artifact:', { exact: false })).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: `${screenshots}/report-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${screenshots}/report-desktop.png`, fullPage: true });
  const emptyContext = await browser.newContext({
    storageState: '/tmp/kynetic-crm-e2e-lane-a-owner-b.json'
  });
  const emptyPage = await emptyContext.newPage();
  await emptyPage.goto('/dashboard/reports/bbbbbbbb-1000-4000-8000-000000000001');
  await expect(emptyPage.getByText('No activity in this range.', { exact: true })).toBeVisible();
  await emptyContext.close();
  await page.goto('/dashboard/reports/bbbbbbbb-1000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { name: "Something's missing" })).toBeVisible();
});

test('F-63 backups nav is available to admin and VA and absent for clients', async ({
  adminPage,
  vaPage,
  authenticatedPage
}) => {
  for (const page of [adminPage, vaPage]) {
    await page.goto('/admin');
    await expect(page.getByRole('link', { name: 'Backups', exact: true })).toBeVisible();
  }
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage.getByRole('link', { name: 'Backups', exact: true })).toHaveCount(
    0
  );
});
