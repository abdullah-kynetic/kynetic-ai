import { redirect } from 'next/navigation';
import { shopContext } from './_lib/context';

export const dynamic = 'force-dynamic';

export default async function ShopIndex() {
  await shopContext();
  redirect('/dashboard/shop/today');
}
