import Link from 'next/link';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { listAdminTenantOverview } from '@/server/admin';
import { requireUser } from '@/server/auth';
import { DEMO_CLIENT_PROFILES } from '@/server/db/seed/demo-client-profiles';
import { Input } from '@/components/ui/input';

const demoSlugs = new Set(DEMO_CLIENT_PROFILES.map((profile) => profile.slug));
type Kind = 'live' | 'demo' | 'churned' | 'operations';

export async function ClientList({ kind, search }: { kind: Kind; search: string }) {
  const user = await requireUser(await headers());
  if (!user.kyneticRole) forbidden();
  const all = await listAdminTenantOverview({ userId: user.id, role: user.kyneticRole });
  const rows = all
    .filter((row) => {
      if (kind === 'live') return row.status === 'active' && !demoSlugs.has(row.slug);
      if (kind === 'demo') return demoSlugs.has(row.slug);
      if (kind === 'churned') return row.status === 'offboarded';
      return row.status !== 'offboarded';
    })
    .filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <section className='space-y-4'>
      <form className='flex flex-wrap gap-2' role='search'>
        <Input
          name='q'
          aria-label='Search clients'
          placeholder='Search clients'
          defaultValue={search}
          className='max-w-sm'
        />
        <button
          className='bg-primary text-primary-foreground rounded-md px-4 text-sm'
          type='submit'
        >
          Search
        </button>
      </form>
      <div className='bg-card overflow-x-auto rounded-xl border'>
        <table className='w-full min-w-[36rem] text-left text-sm'>
          <thead className='bg-surface-sunken'>
            <tr>
              <th className='p-3'>Client</th>
              <th className='p-3'>Status</th>
              <th className='p-3'>Health</th>
              <th className='p-3'>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tenantId} className='border-t'>
                <td className='p-3 font-medium'>{row.name}</td>
                <td className='p-3 capitalize'>{row.status}</td>
                <td className='p-3 capitalize'>{row.healthTone}</td>
                <td className='p-3'>
                  <Link
                    className='text-primary underline-offset-4 hover:underline'
                    href={`/admin/clients/${row.tenantId}`}
                  >
                    Client details
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className='text-muted-foreground p-6'>
                  No matching clients.{' '}
                  <Link className='underline' href='/admin/clients/new'>
                    Onboard a client
                  </Link>{' '}
                  or clear the search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
