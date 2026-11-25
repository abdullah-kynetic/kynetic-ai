import { expect, test } from './fixtures';
import { checkShopPage } from './shop-helpers';

// A-1, A-5, A-8: the shop sidebar, the module gate on routes, and the Demo data banner.
const GROUPS = ['Front desk', 'Shop floor', 'Money', 'Customers and reputation', 'Control'];
const SHOP_ROUTES = [
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
].map((k) => `/dashboard/shop/${k}`);

test.describe('shop client', () => {
  test('sees the five sidebar groups and every entry loads', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/today');
    const sidebar = shopPage.locator('[data-slot="sidebar"]').first();
    for (const label of GROUPS)
      await expect(sidebar.getByText(label, { exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Jobs board' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Away mode' })).toBeVisible();
    // The standard client entries are not in the shop sidebar.
    await expect(sidebar.getByText('Calls & Bookings')).toHaveCount(0);
  });

  test('every shop page passes the page checks at both widths in both themes', async ({
    shopPage
  }) => {
    test.setTimeout(240_000);
    const problems: string[] = [];
    for (const route of SHOP_ROUTES)
      problems.push(...(await checkShopPage(shopPage, route, 'A-S7')).problems);
    expect(problems).toEqual([]);
  });

  test('shows the Demo data banner while sample rows exist', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/today');
    await expect(shopPage.getByTestId('demo-data-banner')).toBeVisible();
    await expect(shopPage.getByTestId('demo-data-banner')).toContainText('Demo data');
  });
});

test.describe('shop client without sample data', () => {
  test('shows no banner and empty states', async ({ emptyShopPage }) => {
    await emptyShopPage.goto('/dashboard/shop/today');
    await expect(emptyShopPage.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
    await expect(emptyShopPage.getByTestId('demo-data-banner')).toHaveCount(0);
    await expect(emptyShopPage.getByText('Nothing to show yet')).toBeVisible();
  });
});

test.describe('client without the module', () => {
  test('keeps the standard sidebar and gets 403 on every shop route', async ({
    authenticatedPage
  }) => {
    await authenticatedPage.goto('/dashboard');
    const sidebar = authenticatedPage.locator('[data-slot="sidebar"]').first();
    await expect(sidebar.getByRole('link', { name: 'Calls & Bookings' })).toBeVisible();
    for (const label of GROUPS)
      await expect(sidebar.getByText(label, { exact: true })).toHaveCount(0);
    // Module-off pages show the 403 screen and none of the shop page. (The HTTP status stays 200
    // because the dashboard's loading boundary has already started streaming; the reads behind the
    // page refuse with ModuleDisabledError, 403, and are covered by the integration tests.)
    for (const route of SHOP_ROUTES) {
      await authenticatedPage.goto(route);
      await expect(authenticatedPage.getByText('Error 403')).toBeVisible();
      await expect(
        authenticatedPage.getByText('You do not have access to this page')
      ).toBeVisible();
      await expect(authenticatedPage.getByTestId('demo-data-banner')).toHaveCount(0);
    }
  });
});
