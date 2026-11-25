import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Weekly report' description='The week in cars and money.'>
      <ShopEmpty
        title='No report yet'
        description='Cars finished and money in will appear here each week.'
      />
    </ShopPage>
  );
}
