import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { getAdminChecklist } from '@/server/admin';
import { authorize, requireUser, resolveActor } from '@/server/auth';
import { AppError } from '@/server/errors';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { GoLiveButton, StepRow } from './checklist-rows';

export const metadata: Metadata = { title: 'Setup checklist' };
export const dynamic = 'force-dynamic';

/** The admin checklist for one client (F-100): owner, due date and status per step, and go-live. */
export default async function ChecklistPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await requireUser(await headers());
  const actor = await resolveActor(user);
  authorize(actor, 'admin.clients.read');
  const role = actor.kyneticRole!;

  let checklist;
  try {
    checklist = await getAdminChecklist({ userId: user.id, role }, tenantId);
  } catch (err) {
    if (err instanceof AppError && (err.code === 'NOT_FOUND' || err.code === 'VALIDATION_FAILED'))
      notFound();
    throw err;
  }
  const done = checklist.steps.filter((s) => s.status === 'done' || s.status === 'n/a').length;

  return (
    <PageContainer
      pageTitle='Setup checklist'
      pageDescription='Every step to take this client live. The owner sees the shared steps as a read-only progress card until go-live.'
    >
      <div className='grid max-w-5xl gap-4'>
        <p className='text-sm' role='status'>
          {checklist.goLiveAt ? (
            <Badge variant='success'>Live since {checklist.goLiveAt.slice(0, 10)}</Badge>
          ) : (
            <>
              {done} of {checklist.steps.length} steps done
            </>
          )}
        </p>
        <ul aria-label='Checklist steps'>
          {checklist.steps.map((s) => (
            <StepRow key={s.stepKey} tenantId={tenantId} step={s} currentUserId={user.id} />
          ))}
        </ul>
        {!checklist.goLiveAt && (
          <GoLiveButton
            tenantId={tenantId}
            openCount={checklist.openCount}
            canMark={role === 'admin'}
          />
        )}
      </div>
    </PageContainer>
  );
}
