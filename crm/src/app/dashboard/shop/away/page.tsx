import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Away mode' description='Close the shop and keep the phones covered.'>
      <ShopEmpty title='Away mode is off' description='Away mode turns on when it is connected.' />
    </ShopPage>
  );
}
