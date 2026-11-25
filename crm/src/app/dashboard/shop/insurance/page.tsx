import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Insurance' description='Cars waiting on the insurance company.'>
      <ShopEmpty
        title='Nothing waiting on insurance'
        description='Cars waiting on an adjuster or a supplement will appear here.'
      />
    </ShopPage>
  );
}
