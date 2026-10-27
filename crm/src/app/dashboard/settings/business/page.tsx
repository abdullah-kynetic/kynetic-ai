import PageContainer from '@/components/layout/page-container';
import { can } from '@/server/auth/permissions';
import { getBusinessSettings, settingsScope } from '@/server/settings';
import { headers } from 'next/headers';
import { BusinessForm } from './business-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Business settings' };

export default async function BusinessSettingsPage() {
  const requestHeaders = await headers();
  const { ctx, actor } = await settingsScope(requestHeaders);
  const settings = await getBusinessSettings(ctx);
  const canEdit = can(actor, 'settings.business', ctx.tenantId);
  return (
    <PageContainer
      pageTitle='Business settings'
      pageDescription='Hours, service area, services and the number Alex transfers calls to.'
    >
      <BusinessForm initial={settings} canEdit={canEdit} />
    </PageContainer>
  );
}
