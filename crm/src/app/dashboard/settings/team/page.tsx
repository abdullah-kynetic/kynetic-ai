import PageContainer from '@/components/layout/page-container';
import { can } from '@/server/auth/permissions';
import { listTeam, settingsScope } from '@/server/settings';
import { headers } from 'next/headers';
import { TeamManager } from './team-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team' };

export default async function TeamSettingsPage() {
  const { ctx, actor } = await settingsScope(await headers());
  // Staff cannot open team settings (F-41).
  if (!can(actor, 'team.manage', ctx.tenantId)) {
    return (
      <PageContainer pageTitle='Team' access={false}>
        {null}
      </PageContainer>
    );
  }
  const team = await listTeam(ctx, actor);
  return (
    <PageContainer pageTitle='Team' pageDescription='Invite staff and choose what they can do.'>
      <TeamManager initial={team} />
    </PageContainer>
  );
}
