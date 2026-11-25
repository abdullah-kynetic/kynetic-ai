import { ShopPage } from '@/components/shop/shop-page';
import { shopContext } from '../../_lib/context';
import { WalkInForm } from './walk-in-form';

export const dynamic = 'force-dynamic';

export default async function NewWalkInPage() {
  const ctx = await shopContext();
  return (
    <ShopPage
      ctx={ctx}
      title='Add walk-in'
      description='Someone is at the counter. This adds them as a lead and opens a job.'
    >
      <WalkInForm />
    </ShopPage>
  );
}
