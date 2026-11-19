import { expect, test } from './fixtures';

const clientRoutes = [
  ['/dashboard/calls', 'Calls'],
  ['/dashboard/contacts', 'Leads'],
  ['/dashboard/documents', 'Documents'],
  ['/dashboard/reports', 'Reports'],
  ['/dashboard/support', 'Support'],
  ['/dashboard/systems', 'My systems']
] as const;

const adminRoutes = [
  ['/admin/backups', 'Backups'],
  ['/admin/operations', 'Jobs and integrations'],
  ['/admin/support', 'Support requests'],
  ['/admin/system-requests', 'System requests'],
  ['/admin/templates', 'Template library'],
  ['/admin/users', 'Users']
] as const;

for (const [persona, routes] of [
  ['client', clientRoutes],
  ['admin', adminRoutes]
] as const) {
  test(`${persona} portal pages fit on mobile and desktop`, async ({
    authenticatedPage,
    adminPage
  }) => {
    const page = persona === 'client' ? authenticatedPage : adminPage;
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      for (const [path, heading] of routes) {
        await page.goto(path);
        await expect(
          page.getByRole('heading', { level: 1, name: heading, exact: true })
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${path} at ${width}px`
        ).toBeLessThanOrEqual(width);
        if (process.env.SHOT_PREFIX) {
          await page.screenshot({
            path: `${process.env.SHOT_PREFIX}${path.replaceAll('/', '-')}-${width}.png`
          });
        }
      }
    }
  });
}

test('Backups preserves administrative access and a keyboard-scrollable history', async ({
  adminPage,
  vaPage
}) => {
  await adminPage.goto('/admin/backups');
  await expect(adminPage.getByRole('button', { name: 'Run backup' })).toBeVisible();
  const history = adminPage.getByRole('region', { name: 'Backup history' });
  const restored = history.getByRole('row').filter({ hasText: 'backups/synthetic/test.dump.enc' });
  await expect(restored.getByRole('cell', { name: 'Passed', exact: true })).toBeVisible();
  await history.focus();
  await expect(history).toBeFocused();

  await vaPage.goto('/admin/backups');
  await expect(vaPage.getByRole('region', { name: 'Backup history' })).toBeVisible();
  await expect(vaPage.getByRole('button', { name: 'Run backup' })).toHaveCount(0);
});
