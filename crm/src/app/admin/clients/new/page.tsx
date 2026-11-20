import { PortalPageContainer as PageContainer } from '@/components/layout/page-container';
import type { Metadata } from 'next';
import { loadAccountTemplates } from '../../templates/actions';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Onboard a client' };

export const dynamic = 'force-dynamic';

export default async function OnboardClientPage() {
  const templates = await loadAccountTemplates();
  return (
    <PageContainer
      pageTitle='Onboard a client'
      pageDescription='One form creates the account, the owner invite, the modules and the setup checklist'
    >
      <OnboardingForm templates={templates.map((t) => ({ id: t.id, name: t.name }))} />
    </PageContainer>
  );
}
