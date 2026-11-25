import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Reviews' description='Ask every customer, and answer every review.'>
      <ShopEmpty
        title='No reviews yet'
        description='Review requests and replies will appear here.'
      />
    </ShopPage>
  );
}
