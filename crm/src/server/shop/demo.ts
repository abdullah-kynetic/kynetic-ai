import { eq } from 'drizzle-orm';
import { contacts, deals } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';

/** The batch tag the sample data seeder writes to `imported_source`. Kept here so the page needs no seed code. */
export const SHOP_DEMO_TAG = 'aa-shop-demo-v1';

/** True while any contact or deal tagged as sample data is present in this tenant. */
export async function hasShopDemoData(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<boolean> {
  return shopRun(ctx, opts, async (tx) => {
    const [contact] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.importedSource, SHOP_DEMO_TAG))
      .limit(1);
    if (contact) return true;
    const [deal] = await tx
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.importedSource, SHOP_DEMO_TAG))
      .limit(1);
    return !!deal;
  });
}
