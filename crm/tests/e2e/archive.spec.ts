import { expect, test } from './fixtures';

test.describe('P2 archive pages (staff only)', () => {
  test('notes: search finds a note by a body phrase and the note opens', async ({ adminPage }) => {
    await adminPage.goto('/admin/archive/notes');
    await expect(adminPage.getByRole('heading', { name: 'Archive' })).toBeVisible();
    await adminPage.getByLabel('Search title and text').fill('Lead status flow');
    await adminPage.getByRole('button', { name: 'Search', exact: true }).click();
    await adminPage.getByRole('link', { name: 'Agency Overview' }).click();
    await expect(adminPage.getByRole('heading', { name: 'Agency Overview' })).toBeVisible();
    await expect(adminPage.getByText('New Lead -> Contacted')).toBeVisible();
  });

  test('tasks: filter by status', async ({ adminPage }) => {
    await adminPage.goto('/admin/archive/tasks?status=DONE');
    await expect(adminPage.getByRole('region', { name: 'Tasks' })).toBeVisible();
    await expect(adminPage.getByText(/Revoke the leaked Cal\.com key/)).toBeVisible();
  });

  test('attachments and records load', async ({ adminPage }) => {
    await adminPage.goto('/admin/archive/attachments');
    await expect(adminPage.getByText('wave2-raw.csv')).toBeVisible();
    await adminPage.goto('/admin/archive/records');
    await expect(adminPage.getByText('AM-1 Roofing Inc').first()).toBeVisible();
  });

  test('VA can read; the list is read-only (no edit controls)', async ({ vaPage }) => {
    await vaPage.goto('/admin/archive/notes');
    await expect(vaPage.getByRole('heading', { name: 'Archive' })).toBeVisible();
    await expect(vaPage.getByRole('button', { name: /delete|edit|save/i })).toHaveCount(0);
  });
});
