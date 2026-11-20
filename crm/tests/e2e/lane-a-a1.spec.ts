import { expect, test } from './fixtures';

test('A1 reviews, referrals and usage pages load for the owner and show in the nav', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/reputation');
  const reputation = page.getByRole('navigation', { name: 'Reputation pages' });
  for (const name of ['Reviews', 'Referrals']) {
    await expect(reputation.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await page.goto('/dashboard/help');
  await expect(
    page.getByRole('navigation', { name: 'Help pages' }).getByRole('link', { name: 'Usage' })
  ).toBeVisible();

  await page.goto('/dashboard/reviews');
  await expect(page.getByRole('heading', { name: 'Reviews', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Google', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Request a review/i })).toBeVisible();

  await page.goto('/dashboard/referrals');
  await expect(page.getByText('Synthetic Referee').first()).toBeVisible();
  await page.goto('/dashboard/referrals?status=lost');
  await expect(page.getByText('Synthetic Referee')).toHaveCount(0);

  await page.goto('/dashboard/usage');
  await expect(page.getByRole('heading', { name: 'Usage', exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\$\d/)).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
