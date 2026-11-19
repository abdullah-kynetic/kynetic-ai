import { expect, test } from './fixtures';

test('moving a synthetic sales card saves its stage', async ({ adminPage: page }) => {
  await page.goto('/admin/prospecting');
  const create = page.getByRole('button', { name: 'Create synthetic agency workspace' });
  if (await create.isVisible()) {
    await create.click();
    await page.goto('/admin/prospecting');
  }
  await page.getByLabel('Name', { exact: true }).fill('Board Prospect');
  await page.getByLabel('Synthetic email').fill('board-prospect@example.test');
  await page.locator('#source').selectOption('inbound:form');
  await page.getByRole('button', { name: 'Add lead', exact: true }).click();
  await page.goto('/admin/sales');
  const card = page.getByRole('button', { name: /Board Prospect/ });
  await expect(card).toBeVisible();
  await card.dragTo(page.getByRole('region', { name: 'Audit sent stage' }));
  await expect(
    page
      .getByRole('region', { name: 'Audit sent stage' })
      .getByRole('button', { name: /Board Prospect/ })
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Audit sent stage' })
      .getByRole('button', { name: /Board Prospect/ })
  ).toBeVisible();
});
