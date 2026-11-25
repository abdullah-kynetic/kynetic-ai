import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Money in and out' description='What came in, and what went out.'>
      <ShopEmpty
        title='No money recorded yet'
        description='Paid jobs will appear here. Expenses turn on when they are connected.'
      />
    </ShopPage>
  );
}
