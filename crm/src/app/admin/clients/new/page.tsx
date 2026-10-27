import PageContainer from '@/components/layout/page-container';
import type { Metadata } from 'next';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = { title: 'Onboard a client' };

export default function OnboardClientPage() {
  return (
    <PageContainer
      pageTitle='Onboard a client'
      pageDescription='One form creates the account, the owner invite, the modules and the setup checklist.'
    >
      <OnboardingForm />
    </PageContainer>
  );
}
