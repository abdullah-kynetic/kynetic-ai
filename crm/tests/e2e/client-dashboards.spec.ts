import { expect, test } from './fixtures';

test('Leads overview is a real dashboard with tiles, charts and a contacts link', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/leads');
  const tiles = page.getByRole('list', { name: 'Leads in numbers' });
  await expect(tiles.getByRole('listitem')).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Lead sources' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent lead activity' })).toBeVisible();
  await page.getByRole('link', { name: 'See all contacts' }).click();
  await expect(page).toHaveURL(/\/dashboard\/leads\/contacts$/);
  await expect(page.getByRole('heading', { name: 'Leads', exact: true }).first()).toBeVisible();
});

test('Calls and bookings overview shows tiles, trend and upcoming appointments', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/bookings');
  await expect(
    page.getByRole('list', { name: 'Calls and bookings in numbers' }).getByRole('listitem')
  ).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Upcoming appointments' })).toBeVisible();
  await page.getByRole('link', { name: 'Open appointments' }).click();
  await expect(page).toHaveURL(/\/dashboard\/bookings\/appointments$/);
});

test('Reputation overview shows rating tiles or a clear plan message', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/reputation');
  const tiles = page.getByRole('list', { name: 'Reputation in numbers' });
  const gated = page.getByText('Reputation is not part of your plan');
  await expect(tiles.or(gated)).toBeVisible();
  if (await tiles.isVisible()) {
    await expect(tiles.getByRole('listitem')).toHaveCount(4);
    await expect(page.getByRole('link', { name: 'Open reviews' })).toBeVisible();
  }
});

test('Help overview shows request counts above the support form', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/help');
  await expect(
    page.getByRole('list', { name: 'Help in numbers' }).getByRole('listitem')
  ).toHaveCount(4);
  await expect(page.getByLabel('Subject')).toBeVisible();
});

test('Overview dashboards fit a phone width without horizontal scroll', async ({
  authenticatedPage: page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    '/dashboard/leads',
    '/dashboard/bookings',
    '/dashboard/reputation',
    '/dashboard/help'
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
