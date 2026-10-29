import { expect, test } from './fixtures';

test('F-63 admin sees encrypted backup and restore status', async ({ adminPage }) => {
  await adminPage.goto('/admin/backups');
  await expect(adminPage.getByRole('heading', { name: 'Backups' })).toBeVisible();
  await expect(adminPage.getByText('restore_test')).toBeVisible();
  await expect(adminPage.getByText('Passed')).toBeVisible();
  await expect(adminPage.getByRole('button', { name: 'Run backup' })).toBeVisible();
});
