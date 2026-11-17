import { expect, test } from './fixtures';

const CLIENT = '11111111-1111-4111-8111-111111111111';

test('Clients list: headline, numbers, pills with words, and the health legend', async ({
  adminPage: page
}) => {
  await page.goto('/admin/clients');
  await expect(page.getByRole('heading', { level: 1, name: 'All clients' })).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Clients in numbers' }).getByRole('listitem')
  ).toHaveCount(4);
  await expect(
    page.getByRole('main').getByRole('link', { name: 'Onboard a client' })
  ).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Tenant C' })).toContainText('At risk');
});

test('Client page: tabs sit above the content and mark the current page', async ({
  adminPage: page
}) => {
  await page.goto(`/admin/clients/${CLIENT}`);
  const tabs = page.getByRole('navigation', { name: 'Client tabs' });
  await expect(tabs.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  const tabsBox = await tabs.boundingBox();
  const profileBox = await page.getByRole('heading', { name: 'Profile' }).boundingBox();
  expect(tabsBox!.y).toBeLessThan(profileBox!.y);
});

test('Clients screenshots', async ({ adminPage: page }) => {
  const prefix = process.env.SHOT_PREFIX;
  test.skip(!prefix, 'screenshots only when SHOT_PREFIX is set');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, path] of [
      ['clients', '/admin/clients'],
      ['client', `/admin/clients/${CLIENT}`]
    ]) {
      await page.goto(path);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${prefix}-${name}-${width}.png`, fullPage: true });
    }
  }
});
