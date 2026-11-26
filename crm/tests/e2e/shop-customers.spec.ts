import { expect, test } from './fixtures';
import { checkShopPage } from './shop-helpers';

// E-1 to E-5: Customers, Reviews, Get found, Referrals.
test.describe('customers and reputation', () => {
  test('Customers show spend and review status, and search narrows the list (E-1)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/customers');
    const rows = shopPage.getByTestId('customer-row');
    await expect(rows.first()).toContainText('spent');
    await expect(
      shopPage.getByText(/Left a review|Asked for a review|Not asked yet/).first()
    ).toBeVisible();
    const all = await rows.count();
    expect(all).toBeGreaterThan(10);
    await shopPage.getByLabel('Search customers').fill('Gutierrez');
    await shopPage.getByRole('button', { name: 'Search' }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Marisol Gutierrez');
    await shopPage.getByLabel('Search customers').fill('zzzz-nobody');
    await shopPage.getByRole('button', { name: 'Search' }).click();
    await expect(shopPage.getByText('No customers match that search')).toBeVisible();
  });

  test('Bring back previews the email and Send stays disabled (E-1)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/customers');
    const select = shopPage.getByLabel('Past customer');
    await select.selectOption({ index: 1 });
    await shopPage.getByRole('button', { name: 'Show email' }).click();
    const preview = shopPage.getByTestId('bring-back-preview');
    await expect(preview).toContainText('Subject:');
    await expect(preview).toContainText('free estimate');
    await expect(preview.getByRole('button', { name: 'Send' })).toBeDisabled();
    await expect(preview.getByText('Turns on when this is connected')).toBeVisible();
  });

  test('Reviews show the rating, drafted replies and the request list (E-2)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/reviews');
    await expect(shopPage.getByTestId('rating')).toContainText(/\d\.\d/);
    await expect(shopPage.getByTestId('review-reply').first()).toContainText('Drafted reply');
    await expect(shopPage.getByRole('list', { name: 'Review requests' })).toBeVisible();
  });

  test('Approve marks a draft approved and shows it was not posted (E-2)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/reviews');
    await shopPage.waitForLoadState('networkidle');
    const draft = shopPage
      .getByTestId('review-reply')
      .filter({ has: shopPage.getByRole('button', { name: /^Approve reply/ }) })
      .first();
    const who = await draft.locator('p').first().innerText();
    await draft.getByRole('button', { name: /^Approve reply/ }).click();
    const done = shopPage
      .getByTestId('review-reply')
      .filter({ hasText: who.split('·')[0]!.trim() })
      .first();
    await expect(done).toContainText('Approved');
    await expect(done).toContainText('Not posted anywhere');
    await shopPage.reload();
    await expect(
      shopPage
        .getByTestId('review-reply')
        .filter({ hasText: who.split('·')[0]!.trim() })
        .first()
    ).toContainText('Approved');
  });

  test('every customer gets the Google link and there is no star filtering (E-3)', async ({
    shopPage
  }) => {
    for (const route of ['reviews', 'customers', 'found']) {
      await shopPage.goto(`/dashboard/shop/${route}`);
      const body = (await shopPage.locator('main').innerText()).toLowerCase();
      expect(body).not.toMatch(
        /only (ask|send|request).*(happy|5|five)|filter by (star|rating)|min(imum)? rating/
      );
    }
    await shopPage.goto('/dashboard/shop/reviews');
    await expect(shopPage.getByTestId('review-wording')).toContainText(
      'Every customer gets the Google link'
    );
    // No control anywhere on the page that filters by rating.
    await expect(shopPage.getByRole('combobox')).toHaveCount(0);
    await expect(shopPage.getByRole('radio')).toHaveCount(0);
    await expect(
      shopPage.getByRole('button', { name: 'Ask customers for a review' })
    ).toBeDisabled();
  });

  test('Get found lists the checklist and post drafts (E-4)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/found');
    await expect(shopPage.getByTestId('listing')).toHaveCount(5);
    await expect(
      shopPage.getByTestId('listing').filter({ hasText: 'Google Business Profile' })
    ).toContainText('Done');
    await expect(shopPage.getByTestId('post-draft')).toHaveCount(3);
    // Drafted replies are not listings.
    await expect(shopPage.getByText('Reply to Alicia M.')).toHaveCount(0);
  });

  test('Referrals is a Customers tab and opens the existing page (E-5)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/customers');
    const tabs = shopPage.getByRole('navigation', { name: 'Customers pages' });
    await tabs.getByRole('link', { name: 'Referrals' }).click();
    await expect(shopPage).toHaveURL(/\/dashboard\/shop\/referrals/);
    await expect(shopPage.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('empty shop shows designed empty states', async ({ emptyShopPage }) => {
    for (const [route, text] of [
      ['customers', 'No customers yet'],
      ['reviews', 'No reviews to answer'],
      ['found', 'No listings tracked yet']
    ] as const) {
      await emptyShopPage.goto(`/dashboard/shop/${route}`);
      await expect(emptyShopPage.getByText(text)).toBeVisible();
    }
  });

  test('pass the page checks at both widths in both themes', async ({ shopPage }) => {
    test.setTimeout(300_000);
    const problems: string[] = [];
    for (const route of ['customers', 'reviews', 'found'])
      problems.push(
        ...(await checkShopPage(shopPage, `/dashboard/shop/${route}`, 'E-S5')).problems
      );
    expect(problems).toEqual([]);
  });
});
