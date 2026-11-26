import { ShopAreaFrame } from '@/components/shop/shop-area-frame';
import { shopContext } from './_lib/context';

export const dynamic = 'force-dynamic';

/** Gate for every route under /dashboard/shop. Pages check again, because layouts are not re-run on every navigation. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  await shopContext();
  return <ShopAreaFrame>{children}</ShopAreaFrame>;
}
