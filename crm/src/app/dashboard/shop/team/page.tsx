import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Team' description='Who has which cars, and what is in paint.'>
      <ShopEmpty
        title='No jobs assigned yet'
        description='Open jobs by owner and the paint queue will appear here.'
      />
    </ShopPage>
  );
}
