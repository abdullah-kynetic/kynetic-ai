import { ShopPage } from '@/components/shop/shop-page';
import { Badge } from '@/components/ui/badge';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

/** Read-only. Nothing here connects anything; each row says honestly where it stands. */
const CONNECTIONS = [
  {
    name: 'QuickBooks',
    does: 'Pulls paid invoices and expenses into Money in and out.',
    status: 'Phase 2, needs your access'
  },
  {
    name: 'Audatex',
    does: 'Brings estimates and supplements from the estimating system onto each job.',
    status: 'Phase 2, needs your access'
  },
  {
    name: 'Parts Trader',
    does: 'Shows parts orders on the job card.',
    status: 'Phase 2, needs your access'
  },
  {
    name: 'Calendar',
    does: 'Keeps drop-offs and pickups in sync with your own calendar.',
    status: 'Not connected. Appointments live in the portal calendar.'
  },
  {
    name: 'Phone line',
    does: 'Lets the receptionist answer and text from the shop number.',
    status: 'Set up by Kynetic. Not changed from this page.'
  },
  {
    name: 'Google',
    does: 'Brings in reviews and lets replies be posted.',
    status: 'Not connected. Ratings are entered by Kynetic for now.'
  }
] as const;

export default async function ConnectionsPage() {
  const ctx = await shopContext();
  return (
    <ShopPage
      ctx={ctx}
      title='Connections'
      description='What is connected to your shop, and what is not.'
    >
      <ul className='bg-card divide-y rounded-[var(--radius-card)] border' aria-label='Connections'>
        {CONNECTIONS.map((c) => (
          <li
            key={c.name}
            className='flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4'
            data-testid='connection'
          >
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-medium'>{c.name}</p>
              <p className='text-muted-foreground text-xs'>{c.does}</p>
            </div>
            <Badge variant='outline' className='h-auto whitespace-normal'>
              {c.status}
            </Badge>
          </li>
        ))}
      </ul>
    </ShopPage>
  );
}
