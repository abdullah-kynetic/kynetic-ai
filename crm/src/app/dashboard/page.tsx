import PageContainer from '@/components/layout/page-container';
import { SetupProgressCard } from '@/components/onboarding/setup-progress-card';
import { loadSetupProgress } from '@/server/admin';
import { loadShellContext } from '@/server/shell';
import { cookies, headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  // F-100: only the owner sees setup progress, and only until go-live.
  const progress =
    shell?.role === 'owner' && shell.tenant
      ? await loadSetupProgress({
          tenantId: shell.tenant.id,
          userId: shell.user.id,
          role: 'owner'
        })
      : null;

  return (
    <PageContainer
      pageTitle='Dashboard'
      pageDescription='Placeholder. Real pages arrive in later milestones.'
    >
      {progress && <SetupProgressCard progress={progress} />}
      <p className='text-muted-foreground text-sm'>Nothing else here yet.</p>
    </PageContainer>
  );
}
