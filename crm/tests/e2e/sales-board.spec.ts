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
  await expect(
    page.getByRole('region', { name: 'Leads' }).getByText('Board Prospect')
  ).toBeVisible();
  await page.goto('/admin/sales');
  const card = page.getByRole('button', { name: /Board Prospect/ });
  await expect(card).toBeVisible();
  const source = await card.boundingBox();
  const target = await page.getByRole('region', { name: 'Audit sent stage' }).boundingBox();
  if (!source || !target) throw new Error('Sales board card or stage is not visible');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 30, { steps: 12 });
  const saved = page.waitForResponse((r) => r.request().method() === 'POST');
  await page.mouse.up();
  await saved;
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

test('failed sales move restores the original stage', async ({ adminPage: page }) => {
  await page.goto('/admin/sales');
  const sourceStage = page.getByRole('region', { name: 'New stage' });
  const card = sourceStage.getByRole('button').first();
  const cardName = await card.getAttribute('aria-describedby');
  const label = await card.innerText();
  expect(cardName).toBeTruthy();
  await page.route('**/admin/sales', async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed');
    else await route.continue();
  });
  const source = await card.boundingBox();
  const target = await page.getByRole('region', { name: 'Audit sent stage' }).boundingBox();
  if (!source || !target) throw new Error('Sales board card or stage is not visible');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 30, { steps: 12 });
  await page.mouse.up();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Deal stage was not saved' })
  ).toBeVisible();
  await expect(
    sourceStage.getByRole('button').filter({ hasText: label.split('\n')[0]! })
  ).toBeVisible();
});
