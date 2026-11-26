import { expect, test } from './fixtures';
import { checkShopPage } from './shop-helpers';

// B-1 to B-4: Today, Leads, Calls and texts, Calendar for the shop client.
test.describe('front desk', () => {
  test('Today shows the six tiles and both lists (B-1)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/today');
    for (const label of [
      'Cars in shop',
      'Drop-offs today',
      'New leads',
      'Quotes waiting',
      'Money in this week',
      'Calls answered this week'
    ])
      await expect(shopPage.getByText(label, { exact: true }).first()).toBeVisible();
    await expect(shopPage.getByRole('heading', { name: 'Needs you' })).toBeVisible();
    await expect(shopPage.getByRole('heading', { name: 'Running without you' })).toBeVisible();
  });

  test('Leads filter by source and open a detail page (B-2)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/leads');
    const chips = shopPage.getByRole('navigation', {
      name: 'Filter by source'
    });
    await expect(chips.getByRole('link', { name: /^All/ })).toBeVisible();
    await expect(chips.getByRole('link', { name: /Walk-in/ })).toBeVisible();
    await chips.getByRole('link', { name: /Walk-in/ }).click();
    await expect(shopPage).toHaveURL(/source=walk_in/);
    const first = shopPage.locator('main li a[href*="/dashboard/shop/leads/"]').first();
    await first.click();
    await expect(shopPage.getByRole('heading', { name: 'Summary' })).toBeVisible();
    await expect(shopPage.getByRole('heading', { name: 'Conversation' })).toBeVisible();
    await expect(shopPage.getByText('No photos yet')).toBeVisible();
  });

  test('Add walk-in creates a real lead (B-2)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/leads/new');
    // A missing name is refused by the form and nothing is created.
    await shopPage.getByLabel('Phone').fill('5555550177');
    await shopPage.getByRole('button', { name: 'Add walk-in' }).click();
    await expect(shopPage).toHaveURL(/leads\/new/);
    await shopPage.getByLabel('Customer name').fill('Pat Walkin');
    await shopPage.getByLabel('Year').fill('2019');
    await shopPage.getByLabel('Make').fill('Honda');
    await shopPage.getByLabel('Model').fill('Civic');
    await shopPage.getByRole('button', { name: 'Add walk-in' }).click();
    await expect(shopPage.getByRole('heading', { name: 'Pat Walkin', level: 2 })).toBeVisible();
    await shopPage.goto('/dashboard/shop/leads');
    await expect(shopPage.getByText('Pat Walkin').first()).toBeVisible();
  });

  test('Calls and texts shows logs, rules and Where is my car (B-3)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/calls');
    await expect(shopPage.getByRole('heading', { name: 'Where is my car?' })).toBeVisible();
    await expect(shopPage.getByRole('heading', { name: 'Call log' })).toBeVisible();
    await expect(shopPage.getByRole('heading', { name: 'Text log' })).toBeVisible();
    await expect(shopPage.getByText('Thanks for calling AA Auto Body.')).toBeVisible();
    await expect(shopPage.getByText('Turns on when this is connected').first()).toBeVisible();
    const select = shopPage.getByLabel('Car', { exact: true });
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
    await select.selectOption({ index: 1 });
    await shopPage.getByRole('button', { name: 'Show reply' }).click();
    await expect(shopPage.getByTestId('where-preview')).toContainText('Preview only');
  });

  test('Calendar shows a week with types and moves between weeks (B-4)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/calendar');
    await expect(shopPage.getByRole('navigation', { name: 'Week' })).toBeVisible();
    await expect(shopPage.getByText(/Drop-off|Estimate|Pickup/).first()).toBeVisible();
    await shopPage.getByRole('link', { name: /Next week/ }).click();
    await expect(shopPage).toHaveURL(/week=\d{4}-\d{2}-\d{2}/);
  });

  test('all four pages pass the page checks at both widths in both themes', async ({
    shopPage
  }) => {
    test.setTimeout(240_000);
    const problems: string[] = [];
    for (const route of ['today', 'leads', 'calls', 'calendar'])
      problems.push(
        ...(await checkShopPage(shopPage, `/dashboard/shop/${route}`, 'B-S5')).problems
      );
    expect(problems).toEqual([]);
  });
});

test.describe('front desk without sample data', () => {
  test('shows empty states', async ({ emptyShopPage }) => {
    await emptyShopPage.goto('/dashboard/shop/leads');
    await expect(emptyShopPage.getByText('No leads yet')).toBeVisible();
    await emptyShopPage.goto('/dashboard/shop/calls');
    await expect(emptyShopPage.getByText('No calls yet')).toBeVisible();
    await emptyShopPage.goto('/dashboard/shop/calendar');
    await expect(emptyShopPage.getByRole('heading', { name: 'Calendar', level: 2 })).toBeVisible();
  });
});
