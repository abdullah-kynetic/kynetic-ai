import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage
      ctx={ctx}
      title='Today'
      description='What needs you today, and what is running without you.'
    >
      <ShopEmpty
        title='Nothing to show yet'
        description='Cars in the shop, drop-offs, new leads and quotes waiting will appear here as soon as the shop has jobs.'
      />
    </ShopPage>
  );
}
