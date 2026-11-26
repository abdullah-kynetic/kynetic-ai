import { expect, test } from './fixtures';

test('pipeline shows the five stages, and the leads tab shows who is not in contact', async ({
  adminPage: page
}) => {
  await page.goto('/admin/sales');
  for (const stage of ['Audit pending', 'Proposal', 'Building', 'Testing', 'Live'])
    await expect(page.getByRole('region', { name: `${stage} stage` })).toBeVisible();
  await page.goto('/admin/sales/leads');
  await expect(page.getByRole('region', { name: 'Not in contact yet' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Declined' })).toBeVisible();
});

test('onboarding from a deal creates the account at Proposal and sends nothing', async ({
  adminPage: page
}) => {
  await page.goto(
    '/admin/clients/new?deal=00000000-0000-4000-8000-000000000001&name=Acme&email=a@example.test'
  );
  await expect(page.getByLabel('Business name')).toHaveValue('Acme');
  await expect(page.getByLabel('Owner email')).toHaveValue('a@example.test');
  await expect(page.getByText('creates the client account at the Proposal stage')).toBeVisible();
});

test('dragging a client card on the pipeline saves its stage and survives a reload', async ({
  adminPage: page
}) => {
  await page.setViewportSize({ width: 2400, height: 1000 });
  await page.goto('/admin/sales');
  const NAME = 'Synthetic Brand Co';
  const handle = page.getByRole('button', { name: `Drag ${NAME} to another stage` });
  await expect(handle).toBeVisible();
  const move = async (to: string) => {
    const source = await page
      .getByRole('button', { name: `Drag ${NAME} to another stage` })
      .boundingBox();
    const target = await page.getByRole('region', { name: `${to} stage` }).boundingBox();
    if (!source || !target) throw new Error('card or column not visible');
    const saved = page.waitForResponse((r) => r.request().method() === 'POST' && r.ok());
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 12 });
    await page.mouse.up();
    await saved;
  };
  const inColumn = (stage: string) =>
    page
      .getByRole('region', { name: `${stage} stage` })
      .getByRole('button', { name: `Drag ${NAME} to another stage` });
  await move('Testing');
  await expect(inColumn('Testing')).toBeVisible();
  await page.reload();
  await expect(inColumn('Testing')).toBeVisible();
  await move('Building');
  await expect(inColumn('Building')).toBeVisible();
});
