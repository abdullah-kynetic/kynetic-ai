import PageContainer from '@/components/layout/page-container';
import { StatusBadge, Badge, type StatusTone } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { currentTime } from '@/components/timeline/format';
import { Timeline } from '@/components/timeline/timeline';
import { parseTimelineParams } from '@/components/timeline/params';
import { listActivities, type TimelinePage } from '@/server/activity';
import {
  getContactDetail,
  NotFoundError,
  type ConsentStatus,
  type ContactDetail
} from '@/server/contacts';
import { ValidationError } from '@/server/errors';
import { moduleSatisfied } from '@/server/modules/keys';
import { loadShellContext } from '@/server/shell';
import { getTenantTimezone, listAssignees, listEntityTasks } from '@/server/tasks';
import { presentTasks } from '@/components/tasks/present';
import { TaskList } from '@/components/tasks/task-list';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Contact',
  robots: { index: false, follow: false }
};

const CHANNEL_LABEL = {
  phone_call: 'Phone calls',
  sms: 'Text messages',
  email: 'Email'
} as const;

const CONSENT_TONE: Record<ConsentStatus['state'], { tone: StatusTone; label: string }> = {
  none: { tone: 'neutral', label: 'No consent recorded' },
  consented: { tone: 'success', label: 'Consent on file' },
  revoked: { tone: 'warning', label: 'Consent revoked' },
  opted_out: { tone: 'error', label: 'Opted out' },
  dnc: { tone: 'error', label: 'Do not contact' }
};

const STATUS_TONE: Record<string, StatusTone> = {
  new: 'info',
  working: 'info',
  booked: 'success',
  won: 'success',
  lost: 'neutral',
  dead: 'neutral'
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  });

const present = (values: string[]) => values.filter((v) => v.trim() !== '');

export default async function ContactPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    type?: string | string[];
    cursor?: string | string[];
  }>;
}) {
  const [{ id }, sp, cookieStore, requestHeaders] = await Promise.all([
    params,
    searchParams,
    cookies(),
    headers()
  ]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  // A Kynetic user outside any tenant has no contacts to show.
  if (!shell.tenant) notFound();

  let detail: ContactDetail;
  try {
    detail = await getContactDetail(
      { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role },
      id
    );
  } catch (err) {
    // Another tenant's id, a deleted contact and a malformed id all read as the standard 404.
    if (err instanceof NotFoundError || err instanceof ValidationError) notFound();
    throw err;
  }

  const { contact, company, owner, consent } = detail;
  const { types, cursor } = parseTimelineParams(sp);
  const ctx = {
    tenantId: shell.tenant.id,
    userId: shell.user.id,
    role: shell.role
  };
  // A bad cursor in the URL falls back to the first page rather than failing the whole contact page.
  const timeline: TimelinePage = await listActivities(ctx, {
    contactId: id,
    types,
    cursor
  }).catch((err) => {
    if (err instanceof ValidationError) return listActivities(ctx, { contactId: id, types });
    throw err;
  });
  // Tasks are CRM Lite (F-20): without the module the section is not rendered at all.
  const tasksOn = moduleSatisfied(
    { keys: new Set(shell.modules.keys), crmLevel: shell.modules.crmLevel },
    { module: 'crm', level: 'lite' }
  );
  const tasksSection = tasksOn ? await renderTasks(ctx, id) : null;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unnamed contact';
  const phones = present(contact.phones);
  const emails = present(contact.emails);
  const tags = present(contact.tags);
  const address = contact.address as Record<string, string | undefined>;
  const addressLine = [address.street, address.city, address.state, address.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <PageContainer
      pageTitle={name}
      pageDescription={company ? company.name : undefined}
      pageHeaderAction={
        <StatusBadge tone={STATUS_TONE[contact.status] ?? 'neutral'} className='capitalize'>
          {contact.status}
        </StatusBadge>
      }
    >
      <div className='grid gap-4 lg:grid-cols-3'>
        <div className='flex flex-col gap-4 lg:col-span-2'>
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className='grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2'>
                <Field label='Source' value={contact.source} />
                <Field label='Owner' value={owner ? (owner.name ?? owner.email) : null} />
                <Field label='Company' value={company?.name} />
                <Field label='Time zone' value={contact.timezone} />
                <Field label='Address' value={addressLine} />
                <Field label='Added' value={when(contact.createdAt)} />
                <div className='sm:col-span-2'>
                  <dt className='text-muted-foreground'>Tags</dt>
                  <dd className='mt-1 flex flex-wrap gap-1.5'>
                    {tags.length ? (
                      tags.map((t) => (
                        <Badge key={t} variant='outline'>
                          {t}
                        </Badge>
                      ))
                    ) : (
                      <span className='text-muted-foreground'>No tags</span>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Phones and emails</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4 text-sm sm:grid-cols-2'>
              <ContactPoints
                label='Phones'
                items={phones}
                primary={contact.primaryPhoneE164}
                kind='tel'
              />
              <ContactPoints
                label='Emails'
                items={emails}
                primary={contact.primaryEmail}
                kind='mailto'
              />
            </CardContent>
          </Card>

          <Card id='timeline' aria-labelledby='section-Timeline'>
            <CardHeader>
              <CardTitle id='section-Timeline'>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline
                page={timeline}
                basePath={`/dashboard/contacts/${id}`}
                activeTypes={types}
                now={currentTime()}
              />
            </CardContent>
          </Card>

          {tasksSection}

          {(
            [
              ['Notes', 'No notes', 'Notes about this contact will show here.'],
              ['Deals', 'No deals', 'Deals linked to this contact will show here.']
            ] as const
          ).map(([title, empty, hint]) => (
            <Card key={title} aria-labelledby={`section-${title}`}>
              <CardHeader>
                <CardTitle id={`section-${title}`}>{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState title={empty} description={hint} />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className='h-fit'>
          <CardHeader>
            <CardTitle>Consent</CardTitle>
            <CardDescription>What this person agreed to, by channel.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className='flex flex-col gap-3 text-sm'>
              {consent.map((c) => {
                const { tone, label } = CONSENT_TONE[c.state];
                return (
                  <li key={c.channel} className='flex flex-col gap-1'>
                    <span className='font-medium'>{CHANNEL_LABEL[c.channel]}</span>
                    <StatusBadge tone={tone}>{label}</StatusBadge>
                    {c.state !== 'none' && (
                      <span className='text-muted-foreground'>
                        {when(c.capturedAt)} via {c.source.replaceAll('_', ' ')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {contact.doNotCallAt && (
              <p className='text-destructive mt-4 text-sm'>
                On the do-not-call list since {when(contact.doNotCallAt)}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='mt-0.5'>{value || <span className='text-muted-foreground'>Not set</span>}</dd>
    </div>
  );
}

function ContactPoints({
  label,
  items,
  primary,
  kind
}: {
  label: string;
  items: string[];
  primary: string | null;
  kind: 'tel' | 'mailto';
}) {
  return (
    <div>
      <h3 className='text-muted-foreground'>{label}</h3>
      {items.length ? (
        <ul className='mt-1 flex flex-col gap-1'>
          {items.map((v) => (
            <li key={v} className='flex items-center gap-2'>
              <a
                className='text-primary-text underline-offset-4 hover:underline'
                href={`${kind}:${v}`}
              >
                {v}
              </a>
              {v === primary && <Badge variant='neutral'>Primary</Badge>}
            </li>
          ))}
        </ul>
      ) : (
        <p className='text-muted-foreground mt-1'>None on file</p>
      )}
    </div>
  );
}

async function renderTasks(
  ctx: { tenantId: string; userId: string; role: Parameters<typeof listAssignees>[0]['role'] },
  contactId: string
) {
  const at = currentTime();
  const [timezone, assignees, { open, completed }] = await Promise.all([
    getTenantTimezone(ctx),
    listAssignees(ctx),
    listEntityTasks(ctx, { contactId })
  ]);
  const text = presentTasks([...open, ...completed], timezone, at);
  return (
    <Card id='tasks' aria-labelledby='section-Tasks'>
      <CardHeader>
        <CardTitle id='section-Tasks'>Tasks</CardTitle>
      </CardHeader>
      <CardContent>
        <TaskList
          groups={[{ key: 'contact-open', label: 'Open', tasks: open }]}
          completed={completed}
          assignees={assignees}
          timezone={timezone}
          currentUserId={ctx.userId}
          link={{ contactId }}
          emptyTitle='No tasks'
          emptyDescription='Add a follow-up for this contact.'
          {...text}
        />
      </CardContent>
    </Card>
  );
}
