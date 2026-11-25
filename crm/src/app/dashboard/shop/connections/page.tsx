import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage
      ctx={ctx}
      title='Connections'
      description='What is connected to your shop, and what is not.'
    >
      <ShopEmpty title='No connections yet' description='Connected accounts will appear here.' />
    </ShopPage>
  );
}
