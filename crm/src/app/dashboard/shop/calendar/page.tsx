import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage ctx={ctx} title='Calendar' description='Drop-offs, estimates and pickups.'>
      <ShopEmpty
        title='Nothing scheduled'
        description='Booked drop-offs, estimates and pickups will appear here.'
      />
    </ShopPage>
  );
}
