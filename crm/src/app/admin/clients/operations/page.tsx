import Link from 'next/link';
import { ClientList } from '../client-list';
export default async function ClientOperations({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap gap-3 text-sm'>
        <Link href='/admin/support' className='underline'>
          Support requests
        </Link>
        <Link href='/admin/system-requests' className='underline'>
          System requests
        </Link>
        <Link href='/admin/clients/new' className='underline'>
          Onboard a client
        </Link>
      </div>
      <ClientList kind='operations' search={(await searchParams).q ?? ''} />
    </div>
  );
}
