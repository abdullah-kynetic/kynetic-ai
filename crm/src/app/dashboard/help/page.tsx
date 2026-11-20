import { headers } from 'next/headers';
import { StatTiles } from '@/components/layout/stat-tiles';
import { contactsActorScope } from '@/server/contacts';
import { listOwnSupportRequests } from '@/server/support';
import SupportPage from '../support/page';

export const dynamic = 'force-dynamic';

type SupportProps = Parameters<typeof SupportPage>[0];

export default async function HelpOverviewPage(props: SupportProps) {
  const scope = await contactsActorScope(await headers());
  const requests = scope ? await listOwnSupportRequests(scope.ctx, scope.actor) : [];
  const open = requests.filter((r) => r.status !== 'resolved');
  const latest = requests[0];
  return (
    <div className='space-y-8'>
      <StatTiles
        label='Help in numbers'
        tiles={[
          {
            label: 'Open requests',
            value: String(open.length),
            note: 'Waiting on the Kynetic team'
          },
          { label: 'All requests', value: String(requests.length) },
          {
            label: 'Resolved',
            value: String(requests.length - open.length),
            note: 'Closed out'
          },
          {
            label: 'Latest request',
            value: latest ? latest.createdAt.slice(0, 10) : '—',
            note: latest ? latest.subject : 'Nothing sent yet'
          }
        ]}
      />
      <SupportPage {...props} />
    </div>
  );
}
