import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { MessageLogTable } from '@/components/messages/message-log-table';
import { MessageLogFilters } from '@/components/messages/message-log-filters';
import { listMessageLog, messageLogQuerySchema, type MessageLogPage } from '@/server/messaging';
import { ModuleDisabledError } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Messages' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// F-30: every SMS and email the account sent or received, with delivery status. Server-rendered so
// the filters are plain links and a delivery callback shows on the next load.
export default async function MessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const [cookieStore, requestHeaders, params] = await Promise.all([
    cookies(),
    headers(),
    searchParams
  ]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) {
    return (
      <PageContainer pageTitle='Messages'>
        <EmptyState
          title='Pick a client first'
          description='The messages log shows one client at a time.'
        />
      </PageContainer>
    );
  }

  // Unknown filter values are ignored rather than shown as an error.
  const parsed = messageLogQuerySchema.safeParse({
    channel: first(params.channel),
    status: first(params.status),
    cursor: first(params.cursor)
  });
  const query = parsed.success
    ? parsed.data
    : messageLogQuerySchema.parse({
        channel: messageLogQuerySchema.shape.channel.safeParse(first(params.channel)).data,
        status: messageLogQuerySchema.shape.status.safeParse(first(params.status)).data
      });

  let page: MessageLogPage | null = null;
  try {
    page = await listMessageLog(
      { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role },
      query
    );
  } catch (e) {
    if (!(e instanceof ModuleDisabledError)) throw e;
  }
  if (!page) {
    return (
      <PageContainer pageTitle='Messages'>
        <EmptyState
          title='Messages are not turned on'
          description='This account has no messaging service switched on.'
        />
      </PageContainer>
    );
  }

  const filtered = Boolean(query.channel || query.status);
  const nextParams = new URLSearchParams();
  if (query.channel) nextParams.set('channel', query.channel);
  if (query.status) nextParams.set('status', query.status);
  if (page.nextCursor) nextParams.set('cursor', page.nextCursor);

  return (
    <PageContainer
      pageTitle='Messages'
      pageDescription='Every text and email sent or received, with delivery status.'
    >
      <MessageLogFilters channel={query.channel} status={query.status} />
      {page.rows.length === 0 ? (
        <EmptyState
          title={filtered ? 'No matching messages' : 'No messages sent yet'}
          description={
            filtered
              ? 'Try a different filter.'
              : 'Texts and emails your account sends or receives will appear here.'
          }
        />
      ) : (
        <>
          <MessageLogTable rows={page.rows} />
          {page.nextCursor && (
            <div className='mt-4 flex justify-center'>
              <Link
                href={`?${nextParams.toString()}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                Older messages
              </Link>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
