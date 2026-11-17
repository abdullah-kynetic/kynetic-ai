import { expect, test } from './fixtures';

test('admin Today: conclusion headline, numbers, and one button per block', async ({
  adminPage: page
}) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Today');
  const numbers = page.getByRole('list', { name: 'Today in numbers' });
  await expect(numbers.getByRole('listitem')).toHaveCount(4);
  for (const [block, button] of [
    ['Needs you now', 'Open operations'],
    ['Sales today', 'Open dialer'],
    ['Clients needing attention', 'Open all clients'],
    ['Support', 'Open support']
  ]) {
    const region = page.getByRole('region', { name: block, exact: true });
    await expect(region.getByRole('link')).toContainText([button]);
    await expect(region.getByRole('link', { name: button })).toBeVisible();
  }
});

test('admin Today screenshots', async ({ adminPage: page }) => {
  const prefix = process.env.SHOT_PREFIX;
  test.skip(!prefix, 'screenshots only when SHOT_PREFIX is set');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/admin');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${prefix}-today-${width}.png`, fullPage: true });
  }
});
