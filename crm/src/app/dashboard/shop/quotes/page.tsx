import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage
      ctx={ctx}
      title='Quotes'
      description='Estimates that are out, and which ones are closing.'
    >
      <ShopEmpty title='No quotes yet' description='Quoted jobs and follow-ups will appear here.' />
    </ShopPage>
  );
}
