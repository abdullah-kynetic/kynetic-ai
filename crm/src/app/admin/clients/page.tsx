import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { ClientsBoard } from './board';
import { loadClientRows } from './rows';

export const dynamic = 'force-dynamic';

export default async function ClientsBoardPage() {
  const { user, rows } = await loadClientRows();
  const count = (stage: string) => rows.filter((r) => r.stage === stage).length;
  const stats = [
    { label: 'Onboarding', value: count('onboarding') },
    { label: 'Live', value: count('live') },
    { label: 'At risk', value: count('at_risk') },
    { label: 'Churned', value: count('churned') }
  ];
  return (
    <div className='flex min-w-0 flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-muted-foreground text-[15px]'>
          {rows.length === 0
            ? 'No clients yet.'
            : `${rows.length} ${rows.length === 1 ? 'client' : 'clients'} across the lifecycle`}
        </p>
        <Link href='/admin/clients/new' className={buttonVariants({ variant: 'default' })}>
          Onboard a client
        </Link>
      </div>
      <ul aria-label='Clients in numbers' className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        {stats.map((stat) => (
          <li
            key={stat.label}
            className='bg-card flex flex-col gap-1 rounded-[var(--radius-card)] border p-5'
          >
            <span className='text-muted-foreground text-[13px] font-medium'>{stat.label}</span>
            <span className='text-4xl/[1.05] font-semibold tracking-tight tabular-nums'>
              {stat.value}
            </span>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? (
        <section className='bg-card space-y-3 rounded-xl border p-6'>
          <h2 className='font-semibold'>No clients yet</h2>
          <p className='text-muted-foreground text-sm'>
            Onboard your first client and it will appear on this board.
          </p>
          <Link className='text-primary underline' href='/admin/clients/new'>
            Onboard a client
          </Link>
        </section>
      ) : (
        <ClientsBoard
          canMove={user.kyneticRole === 'admin'}
          initialCards={rows.map((row) => ({
            id: row.tenantId,
            name: row.name,
            plan: `${row.plan}${row.pricingTier ? ` ${row.pricingTier}` : ''}`,
            health: `${row.healthScore}`,
            stage: row.stage,
            locked: row.locked
          }))}
        />
      )}
    </div>
  );
}
