import PageContainer from '@/components/layout/page-container';
import { can } from '@/server/auth/permissions';
import { stageScope } from '@/server/deals';
import { isModuleEnabled } from '@/server/modules';
import { listTags } from '@/server/settings';
import { headers } from 'next/headers';
import { TagsManager } from './tags-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tags' };

export default async function TagSettingsPage() {
  const { ctx, actor } = await stageScope(await headers());
  // F-85: tag settings belong to CRM Lite. Tags can still be applied to a contact without it.
  if (!(await isModuleEnabled(ctx, 'crm', { level: 'lite' }))) {
    return (
      <PageContainer
        pageTitle='Tags'
        access={false}
        accessFallback={
          <p className='text-muted-foreground text-center text-lg'>
            Tag settings are part of the CRM build-out. Ask Kynetic to add it to your plan.
          </p>
        }
      >
        {null}
      </PageContainer>
    );
  }
  return (
    <PageContainer
      pageTitle='Tags'
      pageDescription='Create, rename and remove the tags you put on contacts.'
    >
      <TagsManager
        initial={await listTags(ctx)}
        canEdit={can(actor, 'settings.business', ctx.tenantId)}
      />
    </PageContainer>
  );
}
