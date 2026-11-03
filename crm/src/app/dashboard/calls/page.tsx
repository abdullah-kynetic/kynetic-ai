import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { EmptyState } from '@/components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getSessionUser, resolveActor, ForbiddenError } from '@/server/auth';
import { CALL_OUTCOMES, CALL_PAGE_SIZES, listCalls, type CallListRow } from '@/server/calls';
import { ValidationError } from '@/server/errors';
import { ModuleDisabledError } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import {
  IconCalendarCheck,
  IconCircleCheck,
  IconFlag,
  IconPhoneIncoming,
  IconPhoneOff,
  IconPhoneOutgoing,
  IconShieldX,
  IconVoice,
  IconUserCheck,
  IconArrowsExchange,
  IconThumbDown,
  IconDots
} from '@tabler/icons-react';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  callsHref,
  formatCallTime,
  formatDuration,
  OUTCOME_META,
  rangeLabel,
  SENTIMENT_LABEL,
  type CallsQueryState
} from './format';

export const metadata: Metadata = { title: 'Calls', robots: { index: false, follow: false } };

const OUTCOME_ICON: Record<string, typeof IconDots> = {
  booked: IconCalendarCheck,
  qualified: IconUserCheck,
  transferred: IconArrowsExchange,
  not_interested: IconThumbDown,
  voicemail: IconVoice,
  no_answer: IconPhoneOff,
  dnc: IconShieldX,
  other: IconDots
};

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function CallsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [raw, cookieStore, requestHeaders] = await Promise.all([
    searchParams,
    cookies(),
    headers()
  ]);
  const claimedTenant = cookieStore.get('tenant_id')?.value;
  const [shell, user] = await Promise.all([
    loadShellContext(requestHeaders, claimedTenant),
    getSessionUser(requestHeaders)
  ]);
  if (!shell || !user) redirect('/sign-in');
  const tenant = shell.tenant;

  const filters: CallsQueryState = {
    outcome: first(raw.outcome),
    direction: first(raw.direction),
    from: first(raw.from),
    to: first(raw.to),
    page: Number(first(raw.page) ?? 1),
    pageSize: Number(first(raw.pageSize) ?? 20)
  };

  const noAccess = (
    <PageContainer pageTitle='Calls' access={false}>
      {null}
    </PageContainer>
  );
  if (!tenant) return noAccess;

  const ctx = { tenantId: tenant.id, userId: shell.user.id, role: shell.role };
  const actor = await resolveActor(user, tenant.id);

  let list;
  try {
    list = await listCalls(actor, ctx, filters);
  } catch (err) {
    // Calls belong to the Alex module (F-70); a direct visit with it off or without access reads as no access.
    if (err instanceof ModuleDisabledError || err instanceof ForbiddenError) return noAccess;
    // A hand-edited URL with a bad filter falls back to the unfiltered list.
    if (err instanceof ValidationError) redirect('/dashboard/calls');
    throw err;
  }

  const applied: CallsQueryState = { ...filters, page: list.page, pageSize: list.pageSize };
  const filtered = Boolean(filters.outcome || filters.direction || filters.from || filters.to);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const hasRows = list.rows.length > 0;

  return (
    <PageContainer pageTitle='Calls' pageDescription='Every call Alex has made or taken.'>
      <nav aria-label='Filter by outcome' className='mb-3 flex flex-wrap gap-2'>
        <OutcomeLink state={{ ...applied, outcome: undefined, page: 1 }} active={!filters.outcome}>
          All
        </OutcomeLink>
        {CALL_OUTCOMES.map((o) => (
          <OutcomeLink
            key={o}
            state={{ ...applied, outcome: o, page: 1 }}
            active={filters.outcome === o}
          >
            {OUTCOME_META[o].label}
          </OutcomeLink>
        ))}
      </nav>

      <form method='get' action='/dashboard/calls' className='mb-4 flex flex-wrap items-end gap-3'>
        {filters.outcome && <input type='hidden' name='outcome' value={filters.outcome} />}
        <label htmlFor='calls-direction' className='flex flex-col gap-1 text-sm'>
          <span className='text-muted-foreground'>Direction</span>
          <NativeSelect
            id='calls-direction'
            name='direction'
            defaultValue={filters.direction ?? ''}
          >
            <option value=''>All</option>
            <option value='outbound'>Outbound</option>
            <option value='inbound'>Inbound</option>
          </NativeSelect>
        </label>
        <label className='flex flex-col gap-1 text-sm'>
          <span className='text-muted-foreground'>From</span>
          <input
            type='date'
            name='from'
            defaultValue={filters.from ?? ''}
            className='border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm'
          />
        </label>
        <label className='flex flex-col gap-1 text-sm'>
          <span className='text-muted-foreground'>To</span>
          <input
            type='date'
            name='to'
            defaultValue={filters.to ?? ''}
            className='border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm'
          />
        </label>
        <Button type='submit' size='sm'>
          Apply
        </Button>
        {filtered && (
          <Link
            href='/dashboard/calls'
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Clear filters
          </Link>
        )}
      </form>

      {!hasRows ? (
        filtered ? (
          <EmptyState
            title='No calls match'
            description='Try a different outcome or date range.'
            action={
              <Link href='/dashboard/calls' className={buttonVariants({ variant: 'outline' })}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title='No calls yet'
            description="Alex's calls will appear here as soon as the first lead is called."
          />
        )
      ) : (
        <>
          <div className='hidden md:block'>
            <Table>
              <caption className='sr-only'>Calls, newest first</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope='col'>Time</TableHead>
                  <TableHead scope='col'>Contact</TableHead>
                  <TableHead scope='col'>Direction</TableHead>
                  <TableHead scope='col' className='text-right'>
                    Duration
                  </TableHead>
                  <TableHead scope='col'>Outcome</TableHead>
                  <TableHead scope='col'>Sentiment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.rows.map((c) => (
                  <TableRow key={c.id} className='h-11'>
                    <TableCell className='whitespace-nowrap'>
                      {formatCallTime(c.startedAt, list.timeZone)}
                    </TableCell>
                    <TableCell>
                      <ContactCell call={c} />
                    </TableCell>
                    <TableCell>
                      <DirectionLabel direction={c.direction} />
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {formatDuration(c.durationS)}
                    </TableCell>
                    <TableCell>
                      <OutcomeChip call={c} />
                    </TableCell>
                    <TableCell>
                      {c.sentiment ? (
                        SENTIMENT_LABEL[c.sentiment]
                      ) : (
                        <span className='text-muted-foreground'>–</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Below md the table becomes a card list (DESIGN_SYSTEM responsive rules). */}
          <ul className='flex flex-col gap-2 md:hidden'>
            {list.rows.map((c) => (
              <li key={c.id} className='bg-card flex flex-col gap-1.5 rounded-lg border p-3'>
                <div className='flex items-start justify-between gap-2'>
                  <ContactCell call={c} />
                  <OutcomeChip call={c} />
                </div>
                <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm'>
                  <span>{formatCallTime(c.startedAt, list.timeZone)}</span>
                  <DirectionLabel direction={c.direction} />
                  <span className='tabular-nums'>{formatDuration(c.durationS)}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className='mt-4 flex flex-wrap items-center justify-between gap-3 text-sm'>
            <p aria-live='polite' className='text-muted-foreground tabular-nums'>
              {rangeLabel(list.page, list.pageSize, list.total)}
            </p>
            <form method='get' action='/dashboard/calls' className='flex items-center gap-2'>
              {filters.outcome && <input type='hidden' name='outcome' value={filters.outcome} />}
              {filters.direction && (
                <input type='hidden' name='direction' value={filters.direction} />
              )}
              {filters.from && <input type='hidden' name='from' value={filters.from} />}
              {filters.to && <input type='hidden' name='to' value={filters.to} />}
              <label
                htmlFor='calls-page-size'
                className='text-muted-foreground flex items-center gap-2'
              >
                Rows per page
                <NativeSelect
                  id='calls-page-size'
                  name='pageSize'
                  defaultValue={String(list.pageSize)}
                  size='sm'
                >
                  {CALL_PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <Button type='submit' variant='outline' size='sm'>
                Set
              </Button>
            </form>
            <nav aria-label='Pagination' className='flex items-center gap-2'>
              {list.page > 1 ? (
                <Link
                  href={callsHref({ ...applied, page: list.page - 1 })}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Previous
                </Link>
              ) : (
                <Button variant='outline' size='sm' disabled>
                  Previous
                </Button>
              )}
              {list.page < pages ? (
                <Link
                  href={callsHref({ ...applied, page: list.page + 1 })}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Next
                </Link>
              ) : (
                <Button variant='outline' size='sm' disabled>
                  Next
                </Button>
              )}
            </nav>
          </div>
        </>
      )}
    </PageContainer>
  );
}

function OutcomeLink({
  state,
  active,
  children
}: {
  state: CallsQueryState;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={callsHref(state)}
      aria-current={active ? 'true' : undefined}
      className={
        active
          ? 'bg-primary text-primary-foreground inline-flex h-8 items-center rounded-full px-3 text-sm font-medium'
          : 'border-input hover:bg-muted inline-flex h-8 items-center rounded-full border px-3 text-sm'
      }
    >
      {children}
    </Link>
  );
}

function OutcomeChip({ call }: { call: CallListRow }) {
  const meta = call.outcome ? OUTCOME_META[call.outcome] : null;
  const Icon = call.outcome ? OUTCOME_ICON[call.outcome] : IconCircleCheck;
  return (
    <span className='flex flex-wrap items-center gap-1.5'>
      {meta ? (
        <Badge variant={meta.tone}>
          <Icon aria-hidden='true' />
          {meta.label}
        </Badge>
      ) : (
        <Badge variant='neutral'>In progress</Badge>
      )}
      {call.flagged && (
        <Badge variant='warning'>
          <IconFlag aria-hidden='true' />
          Flagged
        </Badge>
      )}
    </span>
  );
}

function ContactCell({ call }: { call: CallListRow }) {
  return call.contact ? (
    <Link
      href={`/dashboard/contacts/${call.contact.id}`}
      className='text-primary-text font-medium underline-offset-4 hover:underline'
    >
      {call.contact.name}
    </Link>
  ) : (
    <span className='text-muted-foreground'>Unknown contact</span>
  );
}

function DirectionLabel({ direction }: { direction: CallListRow['direction'] }) {
  const Icon = direction === 'inbound' ? IconPhoneIncoming : IconPhoneOutgoing;
  return (
    <span className='inline-flex items-center gap-1.5'>
      <Icon className='size-4' aria-hidden='true' />
      <span className='capitalize'>{direction}</span>
    </span>
  );
}
