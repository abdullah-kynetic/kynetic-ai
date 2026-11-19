import { expect, test } from './fixtures';

const pages = [
  ['business', '/dashboard/settings/business'],
  ['team', '/dashboard/settings/team'],
  ['branding', '/dashboard/settings/branding'],
  ['pipeline', '/dashboard/settings/pipeline'],
  ['tags', '/dashboard/settings/tags'],
  ['notifications', '/dashboard/settings/notifications'],
  ['automations', '/dashboard/settings/automations'],
  ['custom-fields', '/dashboard/settings/custom-fields'],
  ['alex', '/dashboard/settings/alex']
] as const;

test('Settings routes render without horizontal overflow', async ({ authenticatedPage: page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, path] of pages) {
      await page.goto(path);
      await expect(page.locator('h1').last()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      );
      if (process.env.SHOT_PREFIX) {
        await page.screenshot({
          path: `${process.env.SHOT_PREFIX}-${name}-${width}.png`,
          fullPage: true
        });
      }
    }
  }
});

test('Business settings report save success and validation errors', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/business');
  await page.route('**/api/settings/business', async (route) => {
    await route.fulfill({ status: 200, json: {} });
  });
  await page.getByLabel('Time zone').fill('America/Los_Angeles');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.unroute('**/api/settings/business');
  await page.route('**/api/settings/business', async (route) => {
    await route.fulfill({ status: 400, json: { error: { message: 'Invalid settings' } } });
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Invalid settings' })).toBeVisible();
});

test('Settings stay usable in dark mode and with keyboard focus', async ({
  authenticatedPage: page
}) => {
  await page.goto('/dashboard/settings/business');
  await page.evaluate(() => localStorage.setItem('theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Time zone').focus();
  await expect(page.getByLabel('Time zone')).toBeFocused();
  if (process.env.SHOT_PREFIX) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${process.env.SHOT_PREFIX}-business-dark-390.png`,
      fullPage: true
    });
  }
});

test('CRM-disabled workspace retains its settings access message', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: '/tmp/kynetic-crm-e2e-lane-a-owner-b.json'
  });
  const page = await context.newPage();
  await page.goto('/dashboard/settings/pipeline');
  await expect(page.getByText('Configurable stages are part of the CRM build-out.')).toBeVisible();
  await context.close();
});

test('Unauthenticated visitors cannot open settings', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/dashboard/settings/team');
  await expect(page).toHaveURL(/sign-in/);
  await context.close();
});

test('Notification preferences show a save error', async ({ authenticatedPage: page }) => {
  await page.goto('/dashboard/settings/notifications');
  await page.route('**/api/settings/notifications', async (route) => {
    await route.fulfill({
      status: 500,
      json: { error: { message: 'Unable to save preferences' } }
    });
  });
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Unable to save preferences' })
  ).toBeVisible();
});
