import { expect, test } from './fixtures';
import { adminAreas, clientAreas, vaHelpArea } from '@/config/area-nav';
import nextConfig from '../../next.config';

async function sidebarLinks(page: import('@playwright/test').Page) {
  return page.locator('[data-slot="sidebar-content"] [data-sidebar="menu-item"] a');
}

test('admin, VA and client sidebars have only 4-6 area links and each destination loads', async ({
  adminPage,
  vaPage,
  authenticatedPage
}) => {
  for (const [role, page] of [
    ['admin', adminPage],
    ['VA', vaPage],
    ['client', authenticatedPage]
  ] as const) {
    await page.goto(role === 'client' ? '/dashboard' : '/admin');
    const links = await sidebarLinks(page);
    const hrefs = await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href') ?? '')
    );
    expect(hrefs.length, `${role} sidebar count`).toBeGreaterThanOrEqual(4);
    expect(hrefs.length, `${role} sidebar count`).toBeLessThanOrEqual(6);
    expect(new Set(hrefs).size, `${role} sidebar uniqueness`).toBe(hrefs.length);
    for (const href of hrefs) {
      const response = await page.goto(href);
      expect(response?.status(), `${role}: ${href}`).toBe(200);
    }
  }
});

test('admin areas and every horizontal tab render', async ({ adminPage: page }) => {
  for (const area of adminAreas) {
    expect((await page.goto(area.href))?.status(), area.href).toBe(200);
    await expect(
      page.getByRole('heading', { name: area.title, exact: true }).first()
    ).toBeVisible();
    for (const tab of area.tabs) {
      expect((await page.goto(tab.href))?.status(), tab.href).toBe(200);
      await expect(page.getByRole('navigation', { name: `${area.title} pages` })).toBeVisible();
      await expect(
        page.locator(`nav[aria-label="${area.title} pages"] a[aria-current="page"]`)
      ).toHaveAttribute('href', tab.href);
    }
  }
});

test('client areas and every horizontal tab render', async ({ authenticatedPage: page }) => {
  for (const area of clientAreas) {
    expect((await page.goto(area.href))?.status(), area.href).toBe(200);
    await expect(
      page.getByRole('heading', { name: area.title, exact: true }).first()
    ).toBeVisible();
    for (const tab of area.tabs) {
      expect((await page.goto(tab.href))?.status(), tab.href).toBe(200);
      await expect(
        page.locator(`nav[aria-label="${area.title} pages"] a[aria-current="page"]`)
      ).toHaveAttribute('href', tab.href);
    }
  }
});

test('VA Help has its own main page and horizontal sub-tabs', async ({ vaPage: page }) => {
  for (const tab of vaHelpArea.tabs) {
    expect((await page.goto(tab.href))?.status(), tab.href).toBe(200);
    await expect(page.getByRole('navigation', { name: 'Help pages' })).toBeVisible();
    await expect(
      page.locator('nav[aria-label="Help pages"] a[aria-current="page"]')
    ).toHaveAttribute('href', tab.href);
  }
});

test('moved entry URLs return permanent redirects', async ({ request }) => {
  const redirects = await nextConfig.redirects!();
  const legacy = redirects.filter(
    ({ source }) => source.startsWith('/admin/') || source.startsWith('/dashboard/')
  );
  expect(legacy.length).toBeGreaterThanOrEqual(45);
  for (const { source, destination, statusCode } of legacy) {
    const from = source
      .replace(/:proposalId|:id/g, '00000000-0000-4000-8000-000000000001')
      .replace(':path*', 'notes');
    const to = destination
      .replace(/:proposalId|:id/g, '00000000-0000-4000-8000-000000000001')
      .replace(':path*', 'notes');
    const response = await request.get(from, { maxRedirects: 0 });
    expect(statusCode, source).toBe(301);
    expect(response.status(), from).toBe(301);
    expect(response.headers().location, from).toBe(to);
  }
});
