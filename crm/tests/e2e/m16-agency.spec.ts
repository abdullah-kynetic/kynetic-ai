import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('M16 F-05/F-14/F-17: admin uses an isolated synthetic agency workspace', async ({
  adminPage,
  authenticatedPage,
  vaPage
}) => {
  await adminPage.goto('/admin/agency');
  const setup = adminPage.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await setup.isVisible()) await setup.click();
  await expect(adminPage.getByText('Synthetic workspace ·')).toBeVisible();
  await expect(adminPage.getByRole('heading', { name: 'Agency workspace' })).toBeVisible();
  await adminPage.getByLabel('Name', { exact: true }).fill('Synthetic Browser Lead');
  await adminPage.getByLabel('Synthetic email').fill('browser-agency@example.test');
  await adminPage.getByLabel('Lead source', { exact: true }).selectOption('outbound:cold_call');
  await adminPage.getByRole('button', { name: 'Add lead', exact: true }).click();
  const row = adminPage.getByRole('listitem').filter({ hasText: 'Synthetic Browser Lead' });
  await expect(row).toBeVisible();
  await row.getByLabel('Stage', { exact: true }).selectOption({ label: 'Interested' });
  await row.getByRole('button', { name: 'Move', exact: true }).click();
  await expect(row.getByLabel('Stage', { exact: true })).toHaveValue(
    (await row
      .getByLabel('Stage', { exact: true })
      .locator('option', { hasText: 'Interested' })
      .getAttribute('value')) ?? 'missing'
  );
  await adminPage.getByLabel('Direction', { exact: true }).selectOption('inbound');
  await adminPage.getByRole('button', { name: 'Filter', exact: true }).click();
  // Other browser scenarios may have created inbound fixtures. This outbound row must disappear.
  await expect(row).toHaveCount(0);
  await adminPage.goto('/admin/agency');
  await adminPage.setViewportSize({ width: 390, height: 844 });
  const axe = await new AxeBuilder({ page: adminPage })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(axe.violations).toEqual([]);
  await authenticatedPage.goto('/admin/agency');
  await expect(
    authenticatedPage.getByRole('heading', { name: 'Agency workspace' })
  ).not.toBeVisible();
  await vaPage.goto('/admin/agency');
  await expect(vaPage.getByRole('heading', { name: 'Agency workspace' })).not.toBeVisible();
});
