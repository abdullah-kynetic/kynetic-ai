import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage
      ctx={ctx}
      title='Customers'
      description='Everyone you have worked with, and what they spent.'
    >
      <ShopEmpty
        title='No customers yet'
        description='Customers will appear here after their first job.'
      />
    </ShopPage>
  );
}
