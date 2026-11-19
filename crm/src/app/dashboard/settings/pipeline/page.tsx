import { SettingsPage } from '../settings-page';
import { can } from '@/server/auth/permissions';
import { listStagesWithCounts, stageScope } from '@/server/deals';
import { isModuleEnabled } from '@/server/modules';
import { headers } from 'next/headers';
import { StagesManager } from './stages-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pipeline stages' };

export default async function PipelineSettingsPage() {
  const { ctx, actor } = await stageScope(await headers());
  // F-85: configurable stages belong to CRM Lite. Without it the board keeps the default stages.
  if (!(await isModuleEnabled(ctx, 'crm', { level: 'lite' }))) {
    return (
      <SettingsPage
        pageTitle='Pipeline stages'
        access={false}
        accessFallback={
          <p className='text-muted-foreground text-sm'>
            Configurable stages are part of the CRM build-out. Ask Kynetic to add it to your plan.
          </p>
        }
      >
        {null}
      </SettingsPage>
    );
  }
  const stages = await listStagesWithCounts(ctx);
  return (
    <SettingsPage
      pageTitle='Pipeline stages'
      pageDescription='Rename, reorder and add the stages your deals move through. Deals keep their stage.'
    >
      <StagesManager initial={stages} canEdit={can(actor, 'settings.business', ctx.tenantId)} />
    </SettingsPage>
  );
}
