import { headers } from 'next/headers';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contactsActorScope } from '@/server/contacts';
import { listOwnSupportRequests } from '@/server/support';
import { submitSupportRequestAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' } as const;

export default async function SupportPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const scope = await contactsActorScope(await headers());
  if (!scope)
    return (
      <PageContainer pageTitle='Support' access={false}>
        {null}
      </PageContainer>
    );
  const query = await searchParams;
  const requests = await listOwnSupportRequests(scope.ctx, scope.actor);
  return (
    <PageContainer
      pageTitle='Support'
      pageDescription='Ask the Kynetic team for help. We will reply by email.'
    >
      <div className='grid max-w-3xl gap-8'>
        <form action={submitSupportRequestAction} className='grid gap-4'>
          {query.sent ? (
            <p role='status' className='rounded border p-3'>
              Thanks. Your request was sent to the Kynetic team.
            </p>
          ) : null}
          {query.error ? (
            <p role='alert' className='rounded border border-destructive p-3'>
              Add a short subject and a message, then try again.
            </p>
          ) : null}
          <div className='grid gap-2'>
            <label htmlFor='support-subject' className='font-medium'>
              Subject
            </label>
            <Input id='support-subject' name='subject' required maxLength={200} />
          </div>
          <div className='grid gap-2'>
            <label htmlFor='support-body' className='font-medium'>
              What do you need help with?
            </label>
            <Textarea id='support-body' name='body' required maxLength={5000} rows={6} />
          </div>
          <div>
            <Button type='submit' className='min-h-11'>
              Send request
            </Button>
          </div>
        </form>
        <section aria-labelledby='support-history' className='grid gap-3'>
          <h2 id='support-history' className='text-lg font-semibold'>
            Your requests
          </h2>
          {requests.length === 0 ? (
            <p className='text-muted-foreground'>No requests yet.</p>
          ) : (
            <ul className='grid gap-3'>
              {requests.map((request) => (
                <li key={request.id} className='rounded border p-3'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <span className='font-medium'>{request.subject}</span>
                    <span className='text-sm'>{STATUS_LABEL[request.status]}</span>
                  </div>
                  <p className='text-muted-foreground mt-1 whitespace-pre-wrap text-sm'>
                    {request.body}
                  </p>
                  <p className='text-muted-foreground mt-2 text-xs'>
                    Sent {new Date(request.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
