import { PortalPageContainer as PageContainer } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { loadClientBuildState, type BuildStage } from '@/server/admin/build-systems';
import { loadShellContext } from '@/server/shell';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Build progress' };
export const dynamic = 'force-dynamic';

const STEPS: { stage: BuildStage; label: string }[] = [
  { stage: 'planned', label: 'Planned' },
  { stage: 'building', label: 'Building' },
  { stage: 'testing', label: 'Testing' },
  { stage: 'live', label: 'Live' }
];

const PHASE_COPY = {
  building: {
    title: 'We are building your systems',
    text: 'Each system below is being set up for your business. You will see it move from Building to Testing to Live. Your working pages open when everything is live.'
  },
  testing: {
    title: 'We are testing your systems',
    text: 'Everything is built. We are testing each system with real scenarios before we turn it on. Your working pages open when testing is done.'
  }
} as const;

export default async function BuildProgressPage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell?.tenant) redirect('/dashboard');
  const state = await loadClientBuildState({
    tenantId: shell.tenant.id,
    userId: shell.user.id,
    role: shell.role
  });
  // Live clients, and clients with no systems listed yet, use the normal portal.
  if (!state) redirect('/dashboard');
  const copy = PHASE_COPY[state.phase];
  const live = state.systems.filter((s) => s.stage === 'live').length;
  return (
    <PageContainer pageTitle='Build progress' pageDescription={copy.title}>
      <p className='text-muted-foreground max-w-prose text-sm'>{copy.text}</p>
      <p className='mt-3 text-sm' role='status'>
        {live} of {state.systems.length} systems live
      </p>
      <ul className='mt-4 grid gap-4 lg:grid-cols-2'>
        {state.systems.map((s) => {
          const at = STEPS.findIndex((x) => x.stage === s.stage);
          return (
            <li key={s.key} className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'>
              <div className='flex items-start justify-between gap-3'>
                <h2 className='font-medium'>{s.name}</h2>
                <Badge
                  variant={
                    s.stage === 'live' ? 'success' : s.stage === 'planned' ? 'neutral' : 'info'
                  }
                >
                  {STEPS[at]?.label}
                </Badge>
              </div>
              {s.outcome && <p className='mt-2 text-sm'>{s.outcome}</p>}
              <ol className='mt-4 grid grid-cols-4 gap-1' aria-label={`${s.name} progress`}>
                {STEPS.map((step, i) => (
                  <li key={step.stage} aria-current={i === at ? 'step' : undefined}>
                    <div className={`h-1.5 rounded-full ${i <= at ? 'bg-primary' : 'bg-muted'}`} />
                    <span
                      className={`mt-1 block text-xs ${i === at ? 'font-medium' : 'text-muted-foreground'}`}
                    >
                      {step.label}
                    </span>
                  </li>
                ))}
              </ol>
              {s.note && <p className='text-muted-foreground mt-3 text-sm'>{s.note}</p>}
            </li>
          );
        })}
      </ul>
    </PageContainer>
  );
}
