import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const NAME = 'Synthetic Brand Co';

const saved = (page: Page) =>
  page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/admin/clients')
  );

async function drag(page: Page, card: Locator, stage: string) {
  // Six stage columns scroll sideways; a wide window keeps the source and target on screen together.
  await page.setViewportSize({ width: 2400, height: 1000 });
  // More clients on the board push this card down; bring it into view before reading its box.
  await card.scrollIntoViewIfNeeded();
  const source = await card.boundingBox();
  const target = await page.getByRole('region', { name: `${stage} stage` }).boundingBox();
  if (!source || !target) throw new Error('Client card or stage is not visible');
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + 40, { steps: 12 });
  await page.mouse.up();
}

const cardIn = (page: Page, stage: string) =>
  page
    .getByRole('region', { name: `${stage} stage` })
    .getByRole('button', { name: new RegExp(NAME) });

test('dragging a client saves its stage and survives a reload', async ({ adminPage: page }) => {
  await page.goto('/admin/clients');
  const card = page.getByRole('button', { name: new RegExp(NAME) });
  await expect(card).toBeVisible();
  const first = saved(page);
  await drag(page, card, 'Churned');
  await first;
  await expect(cardIn(page, 'Churned')).toBeVisible();
  await page.reload();
  await expect(cardIn(page, 'Churned')).toBeVisible();
  // The Churned tab lists it too.
  await page.goto('/admin/clients/churned');
  await expect(page.getByRole('row').filter({ hasText: NAME })).toBeVisible();
  // Move it back so other specs see the original board.
  await page.goto('/admin/clients');
  const back = saved(page);
  await drag(page, page.getByRole('button', { name: new RegExp(NAME) }), 'Building');
  await back;
  await expect(cardIn(page, 'Building')).toBeVisible();
  await page.reload();
  await expect(cardIn(page, 'Building')).toBeVisible();
});

test('a failed save puts the client back and shows an error', async ({ adminPage: page }) => {
  await page.goto('/admin/clients');
  const start = await page
    .getByRole('region', { name: /stage$/ })
    .filter({ has: page.getByRole('button', { name: new RegExp(NAME) }) })
    .getAttribute('aria-label');
  const startStage = start!.replace(/ stage$/, '');
  const other = startStage === 'At risk' ? 'Building' : 'At risk';
  await page.route('**/admin/clients', async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed');
    else await route.continue();
  });
  await drag(page, page.getByRole('button', { name: new RegExp(NAME) }), other);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Client stage was not saved' })
  ).toBeVisible();
  await expect(cardIn(page, startStage)).toBeVisible();
});

test('filterable client tables link to client detail', async ({ adminPage: page }) => {
  await page.goto('/admin/clients/operations');
  await page.getByLabel('Search clients').fill('Tenant C');
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Tenant C' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: NAME })).toHaveCount(0);
  await page.getByLabel('Search clients').fill('zzzz-no-match');
  await page.getByRole('button', { name: 'Filter' }).click();
  await expect(page.getByText('No clients match these filters.')).toBeVisible();
  await page.goto('/admin/clients/operations');
  await page.getByRole('link', { name: 'Tenant C' }).first().click();
  await expect(page).toHaveURL(/\/admin\/clients\/[0-9a-f-]{36}/);
});

test('VA sees the board but cannot move clients', async ({ vaPage: page }) => {
  await page.goto('/admin/clients');
  await expect(page.getByText('Only a Kynetic admin can move clients')).toBeVisible();
});
