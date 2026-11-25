import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Get found' description='Your Google profile and listings.'>
      <ShopEmpty
        title='Nothing tracked yet'
        description='Your profile, listings and posts will appear here.'
      />
    </ShopPage>
  );
}
