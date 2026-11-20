import { expect, test } from './fixtures';

const READY = 'Ready Roofing';

test('admin workspace card opens a searchable switcher with the agency first', async ({
  adminPage: page
}) => {
  await page.goto('/admin');
  const card = page.getByRole('button', { name: /Switch workspace/ });
  await expect(card).toContainText('Kynetic AI');
  await expect(card).toContainText('Agency admin');
  await card.click();
  const list = page.getByRole('listbox', { name: 'Workspaces' });
  await expect(list).toBeVisible();
  await expect(list.getByRole('option').first()).toContainText('Kynetic AI');
  await expect(list.getByRole('option', { name: /Synthetic Brand Co/ })).toBeVisible();

  const search = page.getByRole('combobox', { name: 'Search workspaces' });
  await expect(search).toBeFocused();
  await search.fill('ready');
  await expect(list.getByRole('option')).toHaveCount(1);
  await expect(list.getByRole('option').first()).toContainText(READY);
  await search.fill('zzzz');
  await expect(page.getByText('No workspace matches')).toBeVisible();
});

test('switcher keyboard: arrows move, Enter opens the client, Escape closes and restores focus', async ({
  adminPage: page
}) => {
  await page.goto('/admin');
  const card = page.getByRole('button', { name: /Switch workspace/ });
  await card.click();
  const search = page.getByRole('combobox', { name: 'Search workspaces' });
  await search.fill('Ready');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox', { name: 'Workspaces' })).toBeHidden();
  await expect(card).toBeFocused();

  await card.click();
  await page.getByRole('combobox', { name: 'Search workspaces' }).fill('Ready');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/clients\/44444444-4444-4444-8444-444444444444/);
});

test('View as client starts a read-only session, shows the banner and Exit returns to the admin page', async ({
  adminPage: page
}) => {
  await page.goto('/admin/clients');
  await page.getByRole('button', { name: /Switch workspace/ }).click();
  await page.getByRole('button', { name: `View as client: ${READY}` }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const banner = page.getByRole('region', { name: 'View as client' });
  await expect(banner).toContainText(`Viewing as ${READY} the way they see it`);
  await expect(banner).toContainText('Viewing only');
  await expect(banner).toContainText(/Ends in \d+ min/);
  // The client sees a static card and no switcher while being viewed.
  await expect(page.locator('[data-slot=workspace-card]')).toContainText(READY);
  await expect(page.getByRole('button', { name: /Switch workspace/ })).toHaveCount(0);
  await banner.getByRole('link', { name: 'Exit' }).click();
  await expect(page).toHaveURL(/\/admin\/clients$/);
  await expect(page.getByRole('region', { name: 'View as client' })).toHaveCount(0);
});

test('every write during View as client is refused with a clear message', async ({
  adminPage: page
}) => {
  await page.goto('/admin/clients');
  await page.getByRole('button', { name: /Switch workspace/ }).click();
  await page.getByRole('button', { name: `View as client: ${READY}` }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const origin = new URL(page.url()).origin;
  // A server-action style POST to a dashboard page, a JSON POST, and a PUT/DELETE: all refused.
  for (const [method, path] of [
    // Old addresses answer 301, which turns a POST into a GET, so the writes go to the new ones.
    ['post', '/dashboard/leads/tasks'],
    ['post', '/dashboard/leads/contacts'],
    ['put', '/dashboard/settings/business'],
    ['delete', '/dashboard/leads/contacts']
  ] as const) {
    const res = await page.request[method](path, {
      headers: { origin, 'content-type': 'application/json' },
      data: { reason: 'Fixing something the owner reported' },
      failOnStatusCode: false
    });
    expect(res.status(), `${method} ${path}`).toBe(403);
    expect(await res.text()).toContain('Viewing only');
  }
  // The expiry route does nothing while the 30 minutes are still running.
  await page.goto('/view-as/expired');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('region', { name: 'View as client' })).toBeVisible();
  await page
    .getByRole('region', { name: 'View as client' })
    .getByRole('link', { name: 'Exit' })
    .click();
  await expect(page).toHaveURL(/\/admin\/clients$/);
});

test('a building portal cannot be viewed as the client', async ({ adminPage: page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: /Switch workspace/ }).click();
  await expect(
    page.getByRole('button', { name: 'View as client: Synthetic Brand Co' })
  ).toBeDisabled();
});

test('client owner card is static: no chevron, no switcher, no admin navigation', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard');
  const card = page.locator('[data-slot=workspace-card]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Client portal');
  await expect(page.getByRole('button', { name: /Switch workspace/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'All clients' })).toHaveCount(0);
});

test('shell screenshots at phone and desktop widths', async ({ adminPage, authenticatedPage }) => {
  for (const width of [390, 1280]) {
    for (const [name, page, path] of [
      ['admin', adminPage, '/admin'],
      ['client', authenticatedPage, '/dashboard']
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.screenshot({ path: `/tmp/redesign-shell-${name}-${width}.png` });
      if (width === 390) {
        await page.getByRole('button', { name: 'Toggle Sidebar' }).first().click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `/tmp/redesign-shell-${name}-menu-${width}.png` });
      }
      if (name === 'admin' && width === 1280) {
        await page.getByRole('button', { name: /Switch workspace/ }).click();
        await expect(page.getByRole('listbox', { name: 'Workspaces' })).toBeVisible();
        await page.waitForTimeout(400);
        await page.screenshot({ path: '/tmp/redesign-shell-admin-switcher-1280.png' });
        await page.keyboard.press('Escape');
      }
    }
  }
});
