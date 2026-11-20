import { getAgencyWorkspace } from '@/server/agency';
import { getProspectFunnel } from '@/server/agency/prospects';
import { agencyCaller } from '../agency/caller';
import Overview from '../agency/workspace-overview';
import { FunnelDashboard } from './funnel';

export const dynamic = 'force-dynamic';

export default async function ProspectingFunnelPage(props: {
  searchParams: Parameters<typeof Overview>[0]['searchParams'];
}) {
  const caller = await agencyCaller();
  const workspace = await getAgencyWorkspace(caller);
  if (!workspace) return <Overview {...props} />;
  const funnel = await getProspectFunnel(caller);
  return (
    <div className='space-y-10'>
      <FunnelDashboard funnel={funnel} />
      <Overview {...props} />
    </div>
  );
}
