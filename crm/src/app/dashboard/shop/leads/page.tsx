import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await shopContext();
  return (
    <ShopPage
      ctx={ctx}
      title='Leads'
      description='Everyone who reached out, where they came from, and what happened.'
    >
      <ShopEmpty
        title='No leads yet'
        description='New leads from calls, texts, photo quotes and walk-ins will appear here.'
      />
    </ShopPage>
  );
}
