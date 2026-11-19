import { expect, test } from './fixtures';
import { adminAreas, clientAreas } from '@/config/area-nav';

test('admin areas and every horizontal tab render', async ({ adminPage: page }) => {
  for (const area of adminAreas) {
    await page.goto(area.href);
    await expect(
      page.getByRole('heading', { name: area.title, exact: true }).first()
    ).toBeVisible();
    for (const tab of area.tabs) {
      await page.goto(tab.href);
      await expect(page.getByRole('navigation', { name: `${area.title} pages` })).toBeVisible();
      await expect(
        page.locator(`nav[aria-label="${area.title} pages"] a[aria-current="page"]`)
      ).toHaveAttribute('href', tab.href);
    }
  }
});

test('client areas and every horizontal tab render', async ({ authenticatedPage: page }) => {
  for (const area of clientAreas) {
    await page.goto(area.href);
    await expect(
      page.getByRole('heading', { name: area.title, exact: true }).first()
    ).toBeVisible();
    for (const tab of area.tabs) {
      await page.goto(tab.href);
      await expect(
        page.locator(`nav[aria-label="${area.title} pages"] a[aria-current="page"]`)
      ).toHaveAttribute('href', tab.href);
    }
  }
});

test('moved entry URLs return permanent redirects', async ({ request }) => {
  for (const [from, to] of [
    ['/admin/agency/finance', '/admin/money/finance'],
    ['/admin/templates', '/admin/settings/build'],
    ['/dashboard/contacts', '/dashboard/leads/contacts'],
    ['/dashboard/reviews', '/dashboard/reputation/reviews']
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(301);
    expect(response.headers().location, from).toBe(to);
  }
});
