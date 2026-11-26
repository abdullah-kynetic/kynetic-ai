import { expect, test } from './fixtures';
import { checkShopPage } from './shop-helpers';

// D-1 to D-4: Weekly report, Money in and out, Documents under Money.
test.describe('money pages', () => {
  test('Weekly report shows the numbers, the split, the chart and its text alternative (D-1)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/report');
    for (const label of [
      'Cars done',
      'Money in',
      'Average ticket',
      'Calls answered',
      'Quotes sent',
      'Close rate'
    ])
      await expect(shopPage.getByText(label, { exact: true }).first()).toBeVisible();
    await expect(
      shopPage.getByRole('heading', { name: 'Insurance and out-of-pocket' })
    ).toBeVisible();
    const chart = shopPage.getByTestId('week-bars');
    await expect(chart.getByText(/Money in per week over the last 8 weeks/)).toBeVisible();
    await chart.getByText('Show the numbers').click();
    await expect(chart.getByRole('table')).toBeVisible();
    await expect(chart.getByRole('row')).toHaveCount(9); // header plus eight weeks
  });

  test('the weekly email control is visible and disabled while the flags are off (D-4)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/report');
    await expect(
      shopPage.getByRole('button', { name: 'Email me this report every week' })
    ).toBeDisabled();
    await expect(shopPage.getByText('Turns on when this is connected').first()).toBeVisible();
  });

  test('Money in and out lists money in and shows an empty money out (D-2)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/money');
    await expect(shopPage.getByTestId('money-in').getByRole('listitem').first()).toContainText(
      /\$/
    );
    await expect(shopPage.getByText('No expenses recorded yet')).toBeVisible();
    await expect(shopPage.getByRole('button', { name: 'Add expense' })).toBeDisabled();
  });

  test('Documents is a Help tab and opens the existing page (D-3)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/help');
    const tabs = shopPage.getByRole('navigation', { name: 'Help pages' });
    await tabs.getByRole('link', { name: 'Documents' }).click();
    await expect(shopPage).toHaveURL(/\/dashboard\/help\/documents/);
    await expect(
      shopPage.getByRole('heading', { name: 'Documents', level: 2, exact: true })
    ).toBeVisible();
  });

  test('empty shop shows designed empty states', async ({ emptyShopPage }) => {
    await emptyShopPage.goto('/dashboard/shop/money');
    await expect(emptyShopPage.getByText('No money recorded yet')).toBeVisible();
    await emptyShopPage.goto('/dashboard/shop/report');
    await expect(emptyShopPage.getByText('No cars were picked up this week.')).toBeVisible();
    await expect(emptyShopPage.getByTestId('week-bars')).toContainText('No money came in');
  });

  test('pass the page checks at both widths in both themes', async ({ shopPage }) => {
    test.setTimeout(240_000);
    const problems: string[] = [];
    for (const route of ['report', 'money'])
      problems.push(
        ...(await checkShopPage(shopPage, `/dashboard/shop/${route}`, 'D-S4')).problems
      );
    expect(problems).toEqual([]);
  });
});
