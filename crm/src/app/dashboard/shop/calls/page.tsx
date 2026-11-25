import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Calls and texts' description='Every call and text in one place.'>
      <ShopEmpty
        title='No calls or texts yet'
        description='Calls answered and texts sent and received will appear here.'
      />
    </ShopPage>
  );
}
