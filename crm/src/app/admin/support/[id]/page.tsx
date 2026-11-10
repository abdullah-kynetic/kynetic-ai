import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { statusLabel, SupportTranscript } from '@/components/support/thread';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { decideAdminAccess } from '@/server/admin';
import { getStaffSupportThread, type SupportStatus } from '@/server/support';
import { replyToSupportAction, setSupportStatusAction } from '../actions';

export const dynamic = 'force-dynamic';

const ACTIONS: Record<SupportStatus, { status: SupportStatus; label: string }[]> = {
  open: [
    { status: 'in_progress', label: 'Start' },
    { status: 'resolved', label: 'Resolve' }
  ],
  in_progress: [
    { status: 'resolved', label: 'Resolve' },
    { status: 'open', label: 'Reopen' }
  ],
  resolved: [{ status: 'open', label: 'Reopen' }]
};

export default async function AdminSupportThreadPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const { id } = await params;
  const thread = await getStaffSupportThread({ userId: access.user.id, role: access.role }, id);
  if (!thread) notFound();
  return (
    <PageContainer
      pageTitle={thread.subject}
      pageDescription={`${thread.tenantName} · ${statusLabel(thread.status)}`}
    >
      <div className='grid max-w-3xl gap-6'>
        <SupportTranscript body={thread.body} messages={thread.messages} viewer='kynetic' />
        <div className='flex flex-wrap gap-2'>
          {ACTIONS[thread.status].map((next) => (
            <form action={setSupportStatusAction} key={next.status}>
              <input type='hidden' name='id' value={thread.id} />
              <input type='hidden' name='status' value={next.status} />
              <Button type='submit' variant='outline'>
                {next.label}
              </Button>
            </form>
          ))}
        </div>
        <form action={replyToSupportAction.bind(null, thread.id)} className='grid gap-3'>
          <label htmlFor='admin-support-reply' className='font-medium'>
            Reply
          </label>
          <Textarea id='admin-support-reply' name='body' required maxLength={5000} rows={4} />
          <div>
            <Button type='submit'>Send reply</Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
