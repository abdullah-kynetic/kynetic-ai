import { getAgencyWorkspace } from '@/server/agency';
import { getMoneyOverview } from '@/server/agency/money';
import { agencyCaller } from '../agency/caller';
import { AgencyWorkspaceMissing } from '../agency/workspace-missing';
import { MoneyDashboard } from './overview';

export const dynamic = 'force-dynamic';

export default async function MoneyOverviewPage() {
  const caller = await agencyCaller();
  if (!(await getAgencyWorkspace(caller))) return <AgencyWorkspaceMissing pageTitle='Money' />;
  return <MoneyDashboard data={await getMoneyOverview(caller)} />;
}
