import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage
      ctx={ctx}
      title='Jobs board'
      description='Every car in the shop, from new lead to picked up.'
    >
      <ShopEmpty
        title='No jobs yet'
        description='Jobs will appear here as cars move through the shop.'
      />
    </ShopPage>
  );
}
