import { expect, test } from './fixtures';

const OLD_ADMIN_ADDRESSES = [
  '/admin',
  '/admin/clients',
  '/admin/clients/new',
  '/admin/portals',
  '/admin/view-as',
  '/admin/support',
  '/admin/system-requests',
  '/admin/templates',
  '/admin/operations',
  '/admin/usage',
  '/admin/users',
  '/admin/backups',
  '/admin/audit',
  '/admin/archive',
  '/admin/archive/notes',
  '/admin/archive/tasks',
  '/admin/archive/records',
  '/admin/archive/attachments',
  '/admin/agency',
  '/admin/agency/inbox',
  '/admin/agency/compose',
  '/admin/agency/dialer',
  '/admin/agency/campaigns',
  '/admin/agency/proposals',
  '/admin/agency/contracts',
  '/admin/agency/finance',
  '/admin/agency/billing',
  '/admin/agency/ops',
  '/admin/clients/11111111-1111-4111-8111-111111111111',
  '/admin/clients/11111111-1111-4111-8111-111111111111/systems',
  '/admin/clients/11111111-1111-4111-8111-111111111111/alex',
  '/admin/clients/11111111-1111-4111-8111-111111111111/reports',
  '/admin/clients/11111111-1111-4111-8111-111111111111/documents',
  '/admin/clients/11111111-1111-4111-8111-111111111111/billing',
  '/admin/clients/11111111-1111-4111-8111-111111111111/checklist',
  '/admin/clients/11111111-1111-4111-8111-111111111111/imports',
  '/admin/clients/11111111-1111-4111-8111-111111111111/webhooks',
  '/admin/clients/11111111-1111-4111-8111-111111111111/service-tokens',
  '/admin/clients/11111111-1111-4111-8111-111111111111/presence',
  '/admin/clients/11111111-1111-4111-8111-111111111111/modules',
  '/admin/clients/11111111-1111-4111-8111-111111111111/offboard'
];

test('phase 7 every old admin address resolves', async ({ adminPage }) => {
  for (const address of OLD_ADMIN_ADDRESSES) {
    const response = await adminPage.request.get(address, { maxRedirects: 0 });
    expect(response.status(), address).toBeLessThan(400);
  }
});

test('phase 7 screenshots at phone and desktop widths', async ({ adminPage, vaPage }) => {
  for (const width of [390, 1280]) {
    await adminPage.setViewportSize({ width, height: 900 });
    await vaPage.setViewportSize({ width, height: 900 });
    await adminPage.goto('/admin');
    await vaPage.goto('/admin');
    await adminPage.screenshot({ path: `/tmp/phase-7-today-admin-${width}.png`, fullPage: true });
    await vaPage.screenshot({ path: `/tmp/phase-7-today-va-${width}.png`, fullPage: true });
    await adminPage.goto('/admin/clients');
    await adminPage.screenshot({ path: `/tmp/phase-7-client-list-${width}.png`, fullPage: true });
    await adminPage.goto('/admin/clients/11111111-1111-4111-8111-111111111111');
    await adminPage.screenshot({ path: `/tmp/phase-7-client-tabs-${width}.png`, fullPage: true });
  }
});
