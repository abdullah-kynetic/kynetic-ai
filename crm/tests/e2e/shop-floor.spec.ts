import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { checkShopPage } from './shop-helpers';

// C-1 to C-5: Jobs board, Quotes, Insurance, Team.
const STAGES = [
  'New lead',
  'Quoted',
  'Waiting on insurance',
  'Parts ordered',
  'In repair and paint',
  'Ready for pickup',
  'Picked up',
  'Lost'
];

const stage = (page: Page, name: string) => page.locator(`[aria-label="${name}"]`);
const saved = (page: Page) =>
  page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/dashboard/shop/jobs')
  );

test.describe('jobs board', () => {
  test('shows the eight stages and car cards (C-1)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/jobs');
    for (const name of STAGES) await expect(stage(shopPage, name)).toBeVisible();
    const card = stage(shopPage, 'In repair and paint').getByRole('article').first();
    await expect(card.getByTestId('car-details')).toContainText('in shop');
    await expect(card.getByTestId('car-details')).toContainText(/\$[\d,]+/);
    await expect(card.getByTestId('car-details')).toContainText(/Insurance|Out-of-pocket/);
  });

  test('the move menu works by keyboard and persists, and shows only a disabled status text (C-1, C-2)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/jobs');
    await expect(shopPage.getByTestId('status-text-preview')).toContainText(
      'Status text sent (demo)'
    );
    await expect(
      shopPage.getByRole('button', { name: 'Text customer on every move' })
    ).toBeDisabled();
    const card = stage(shopPage, 'New lead').getByRole('article').first();
    const label = (await card.getAttribute('aria-label'))!;
    const trigger = card.getByRole('button', { name: `Move ${label} to stage` });
    await trigger.focus();
    await shopPage.keyboard.press('Enter');
    const done = saved(shopPage);
    await shopPage.getByRole('menuitem', { name: 'Parts ordered' }).click();
    await done;
    await expect(
      stage(shopPage, 'Parts ordered').getByRole('article', { name: label })
    ).toBeVisible();
    await shopPage.reload();
    await expect(
      stage(shopPage, 'Parts ordered').getByRole('article', { name: label })
    ).toBeVisible();
    // Move it back so other specs see the original board.
    const back = saved(shopPage);
    await stage(shopPage, 'Parts ordered')
      .getByRole('article', { name: label })
      .getByRole('button', { name: `Move ${label} to stage` })
      .click();
    await shopPage.getByRole('menuitem', { name: 'New lead' }).click();
    await back;
    await shopPage.reload();
    await expect(stage(shopPage, 'New lead').getByRole('article', { name: label })).toBeVisible();
  });

  test('dragging a car moves it (C-1)', async ({ shopPage }) => {
    await shopPage.setViewportSize({ width: 1440, height: 1000 });
    await shopPage.goto('/dashboard/shop/jobs');
    const card = stage(shopPage, 'Quoted').getByRole('article').first();
    const label = (await card.getAttribute('aria-label'))!;
    await card.scrollIntoViewIfNeeded();
    const handle = card.getByRole('button', { name: new RegExp(`^Drag ${label}`) });
    const a = (await handle.boundingBox())!;
    await target(shopPage, 'Waiting on insurance');
    const t = (await stage(shopPage, 'Waiting on insurance').boundingBox())!;
    const done = saved(shopPage);
    await shopPage.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await shopPage.mouse.down();
    await shopPage.mouse.move(t.x + t.width / 2, t.y + 60, { steps: 14 });
    await shopPage.mouse.up();
    await done;
    await expect(
      stage(shopPage, 'Waiting on insurance').getByRole('article', { name: label })
    ).toBeVisible();
    // Put it back (after a reload, so the check also shows the move was saved).
    await shopPage.reload();
    await shopPage.waitForLoadState('networkidle');
    const back = saved(shopPage);
    await stage(shopPage, 'Waiting on insurance')
      .getByRole('article', { name: label })
      .getByRole('button', { name: `Move ${label} to stage` })
      .click();
    await shopPage.getByRole('menuitem', { name: 'Quoted' }).click();
    await back;
  });

  test('the move menu works at phone width (C-1)', async ({ shopPage }) => {
    await shopPage.setViewportSize({ width: 390, height: 844 });
    await shopPage.goto('/dashboard/shop/jobs');
    const card = stage(shopPage, 'New lead').getByRole('article').first();
    await card.scrollIntoViewIfNeeded();
    const label = (await card.getAttribute('aria-label'))!;
    await expect(card.getByRole('button', { name: `Move ${label} to stage` })).toBeVisible();
  });
});

async function target(page: Page, name: string) {
  await stage(page, name).scrollIntoViewIfNeeded();
}

test.describe('quotes, insurance, team', () => {
  test('Quotes shows the close rate and the quotes out (C-3)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/quotes');
    await expect(shopPage.getByTestId('close-rate')).toContainText('%');
    await expect(shopPage.getByText('Won divided by won, lost and still out.')).toBeVisible();
    const rows = shopPage.getByRole('list', { name: 'Quotes out' }).getByRole('listitem');
    await expect(rows.first()).toContainText(/\$[\d,]+/);
    await expect(rows.first()).toContainText(/old|today/);
  });

  test('Follow-ups tab shows each run with its steps and reply state (C-3)', async ({
    shopPage
  }) => {
    await shopPage.goto('/dashboard/shop/quotes');
    await shopPage.getByRole('link', { name: 'Follow-ups' }).click();
    await expect(shopPage).toHaveURL(/tab=followups/);
    const run = shopPage.getByTestId('follow-up-run').first();
    await expect(run).toContainText('Waiting to go out');
    await expect(run).toContainText(/Pending|Next|Sent/);
    await expect(run).toContainText('No reply yet.');
  });

  test('Insurance lists cars waiting and a disabled supplement add (C-4)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/insurance');
    await expect(shopPage.getByTestId('insurance-row').first()).toContainText(/Claim|claim number/);
    await expect(shopPage.getByText('No supplements yet')).toBeVisible();
    await expect(shopPage.getByRole('button', { name: 'Add supplement' })).toBeDisabled();
  });

  test('Team groups open jobs by owner and shows the paint queue (C-5)', async ({ shopPage }) => {
    await shopPage.goto('/dashboard/shop/team');
    await expect(shopPage.getByRole('heading', { name: 'Paint queue' })).toBeVisible();
    await expect(shopPage.getByTestId('paint-queue').getByRole('listitem').first()).toBeVisible();
    await expect(shopPage.getByTestId('team-owner').first()).toContainText('open job');
  });

  test('empty shop shows designed empty states', async ({ emptyShopPage }) => {
    for (const [route, text] of [
      ['jobs', 'No jobs yet'],
      ['quotes', 'No quotes out right now'],
      ['insurance', 'Nothing waiting on insurance'],
      ['team', 'No open jobs yet']
    ] as const) {
      await emptyShopPage.goto(`/dashboard/shop/${route}`);
      await expect(emptyShopPage.getByText(text)).toBeVisible();
    }
  });
});

test.describe('shop floor pages', () => {
  test('pass the page checks at both widths in both themes', async ({ shopPage }) => {
    test.setTimeout(300_000);
    const problems: string[] = [];
    for (const route of ['jobs', 'quotes', 'insurance', 'team'])
      problems.push(
        ...(await checkShopPage(shopPage, `/dashboard/shop/${route}`, 'C-S6')).problems
      );
    expect(problems).toEqual([]);
  });
});
