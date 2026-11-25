import { expect, test } from './fixtures';
import { checkShopPage } from './shop-helpers';

// F-1 to F-4: Away mode, Connections, Settings and Help, and the whole-product pass.
const ALL = [
  'today',
  'leads',
  'calls',
  'calendar',
  'jobs',
  'quotes',
  'insurance',
  'team',
  'report',
  'money',
  'customers',
  'reviews',
  'found',
  'away',
  'connections'
];

test.describe('control', () => {
  test('Away mode saves a date range and alert rules as a setting only (F-1)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/away');
    await shopPage.waitForLoadState('networkidle');
    await expect(shopPage.getByTestId('away-status')).toContainText('Away mode is off');
    await expect(shopPage.getByTestId('summary-preview')).toContainText('in the shop');
    await expect(shopPage.getByRole('button', { name: 'Send me this summary now' })).toBeDisabled();
    await shopPage.getByRole('checkbox', { name: 'Away mode is on' }).check();
    // Turning it on without dates is refused.
    await shopPage.getByRole('button', { name: 'Save away mode' }).click();
    await expect(shopPage.getByText('Pick the first and last day away.')).toBeVisible();
    await shopPage.getByLabel('First day away').fill('2026-12-24');
    await shopPage.getByLabel('Last day away').fill('2026-12-26');
    await shopPage.getByRole('checkbox', { name: 'A finished car nobody has picked up' }).check();
    await shopPage.getByRole('button', { name: 'Save away mode' }).click();
    await expect(shopPage.getByTestId('away-saved')).toBeVisible();
    await shopPage.reload();
    await expect(shopPage.getByTestId('away-status')).toContainText('2026-12-24 to 2026-12-26');
    await expect(shopPage.getByTestId('away-status')).toContainText('setting only');
    await expect(
      shopPage.getByRole('checkbox', { name: 'A finished car nobody has picked up' })
    ).toBeChecked();
    // Put it back so other specs see the original state.
    await shopPage.getByRole('checkbox', { name: 'Away mode is on' }).uncheck();
    await shopPage.getByRole('button', { name: 'Save away mode' }).click();
    await expect(shopPage.getByTestId('away-saved')).toBeVisible();
    await shopPage.reload();
    await expect(shopPage.getByTestId('away-status')).toContainText('Away mode is off');
  });

  test('Connections lists six items with honest status and no controls (F-2)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/connections');
    const items = shopPage.getByTestId('connection');
    await expect(items).toHaveCount(6);
    for (const name of [
      'QuickBooks',
      'Audatex',
      'Parts Trader',
      'Calendar',
      'Phone line',
      'Google'
    ])
      await expect(items.filter({ hasText: name })).toHaveCount(1);
    await expect(items.filter({ hasText: 'QuickBooks' })).toContainText(
      'Phase 2, needs your access'
    );
    await expect(items.getByRole('button')).toHaveCount(0);
    await expect(items.getByRole('link')).toHaveCount(0);
  });

  test('Settings and Help are in Control and every old URL still works (F-3)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/away');
    const sidebar = shopPage.locator('[data-slot="sidebar"]').first();
    await sidebar.getByRole('link', { name: 'Settings' }).click();
    await expect(shopPage).toHaveURL(/\/dashboard\/settings/);
    await shopPage.goto('/dashboard/shop/away');
    await sidebar.getByRole('link', { name: 'Help' }).click();
    await expect(shopPage).toHaveURL(/\/dashboard\/help/);
    for (const url of [
      '/dashboard/pipeline',
      '/dashboard/leads',
      '/dashboard/calls',
      '/dashboard/contacts',
      '/dashboard/appointments',
      '/dashboard/reputation/reviews',
      '/dashboard/reputation/referrals',
      '/dashboard/help/documents',
      '/dashboard/help/reports',
      '/dashboard/settings'
    ]) {
      const response = await shopPage.goto(url);
      expect(response?.status(), url).toBeLessThan(400);
      await expect(shopPage.getByText('Error 403'), url).toHaveCount(0);
      await expect(shopPage.getByText('This page could not be found'), url).toHaveCount(0);
    }
  });
});

test.describe('whole product', () => {
  test('every shop page passes the checks at both widths in both themes (F-4)', async ({
    shopPage
  }) => {
    test.setTimeout(480_000);
    const problems: string[] = [];
    for (const route of ALL)
      problems.push(
        ...(await checkShopPage(shopPage, `/dashboard/shop/${route}`, 'F-S4')).problems
      );
    expect(problems).toEqual([]);
  });

  test('every shop page has a designed empty state or content for a shop with no data (F-4)', async ({
    emptyShopPage
  }) => {
    test.setTimeout(240_000);
    const problems: string[] = [];
    for (const route of ALL) {
      const r = await emptyShopPage.goto(`/dashboard/shop/${route}`);
      if (!r || r.status() >= 400) problems.push(`${route}: HTTP ${r?.status()}`);
      await expect(emptyShopPage.getByRole('heading', { level: 1 })).toBeVisible();
      const text = await emptyShopPage.locator('main').innerText();
      if (/undefined|NaN|\[object|Invalid Date/.test(text)) problems.push(`${route}: bad text`);
    }
    expect(problems).toEqual([]);
  });
});
