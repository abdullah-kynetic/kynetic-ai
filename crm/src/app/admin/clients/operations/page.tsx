import Link from 'next/link';
import { ClientList, type ClientListSearch } from '../client-list';

export const dynamic = 'force-dynamic';
export default async function ClientOperations({
  searchParams
}: {
  searchParams: ClientListSearch;
}) {
  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap gap-3 text-sm'>
        <Link href='/admin/help' className='underline'>
          Support requests
        </Link>
        <Link href='/admin/help/system-requests' className='underline'>
          System requests
        </Link>
        <Link href='/admin/clients/new' className='underline'>
          Onboard a client
        </Link>
      </div>
      <ClientList kind='operations' filters={await searchParams} />
    </div>
  );
}
