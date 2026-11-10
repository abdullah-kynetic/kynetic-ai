import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { statusLabel, SupportTranscript } from '@/components/support/thread';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { contactsActorScope } from '@/server/contacts';
import { getOwnSupportThread } from '@/server/support';
import { replyToSupportAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function SupportThreadPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const scope = await contactsActorScope(await headers());
  if (!scope)
    return (
      <PageContainer pageTitle='Support' access={false}>
        {null}
      </PageContainer>
    );
  const { id } = await params;
  const thread = await getOwnSupportThread(scope.ctx, scope.actor, id);
  if (!thread) notFound();
  const query = await searchParams;
  return (
    <PageContainer pageTitle={thread.subject} pageDescription={statusLabel(thread.status)}>
      <div className='grid max-w-3xl gap-6'>
        <SupportTranscript body={thread.body} messages={thread.messages} viewer='client' />
        <form action={replyToSupportAction.bind(null, thread.id)} className='grid gap-3'>
          {query.error ? (
            <p role='alert' className='rounded border border-destructive p-3'>
              Write a reply, then try again.
            </p>
          ) : null}
          <label htmlFor='support-reply' className='font-medium'>
            Reply
          </label>
          <Textarea id='support-reply' name='body' required maxLength={5000} rows={4} />
          <div>
            <Button type='submit'>Send reply</Button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
