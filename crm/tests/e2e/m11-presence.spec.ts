import { expect, test } from './fixtures';

test('F-83 owner sees enabled online presence and the monthly report section', async ({
  authenticatedPage
}) => {
  await authenticatedPage.goto('/dashboard/presence');
  await expect(authenticatedPage.getByRole('heading', { name: 'Online Presence' })).toBeVisible();
  await expect(authenticatedPage.getByText('Google Business Profile')).toBeVisible();
  await expect(authenticatedPage.getByText('Google: 23 reviews')).toBeVisible();

  await authenticatedPage.goto('/dashboard/reports');
  await authenticatedPage.getByRole('link', { name: 'Open report' }).click();
  await expect(
    authenticatedPage.getByRole('main').getByText('Online Presence', { exact: true })
  ).toBeVisible();
  await expect(authenticatedPage.getByText('Google: 23 reviews')).toBeVisible();
});
