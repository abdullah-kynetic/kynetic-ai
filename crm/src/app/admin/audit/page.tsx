/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- scrollable table regions must be keyboard focusable (WCAG 2.1.1) */
import PageContainer from '@/components/layout/page-container';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  AUDIT_PAGE_SIZE,
  auditFiltersSchema,
  decideAdminAccess,
  listAuditTenantOptions,
  searchAuditLog,
  type AuditRow
} from '@/server/admin';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { forbidden, redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function formatWhen(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : '-';
}

function Json({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <div className='min-w-0'>
      <p className='text-muted-foreground mb-1 text-xs font-medium'>{label}</p>
      <pre className='bg-muted max-h-64 overflow-auto rounded-md p-2 text-xs break-words whitespace-pre-wrap'>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function Detail({ row }: { row: AuditRow }) {
  return (
    <details>
      <summary className='text-foreground cursor-pointer text-sm underline underline-offset-2'>
        View
        <span className='sr-only'>
          {' '}
          details for {row.action} at {formatWhen(row.createdAt)}
        </span>
      </summary>
      <div className='mt-2 grid gap-3 md:grid-cols-2'>
        <Json label='Before' value={row.before} />
        <Json label='After' value={row.after} />
        <dl className='text-muted-foreground col-span-full grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs'>
          <dt>Entity ID</dt>
          <dd className='break-all'>{row.entityId ?? '-'}</dd>
          <dt>Actor</dt>
          <dd className='break-all'>{row.actorUserId ?? '-'}</dd>
          <dt>Tenant</dt>
          <dd className='break-all'>{row.tenantId ?? '-'}</dd>
          <dt>IP</dt>
          <dd>{row.ip ?? '-'}</dd>
          <dt>User agent</dt>
          <dd className='break-all'>{row.userAgent ?? '-'}</dd>
        </dl>
      </div>
    </details>
  );
}

/**
 * Audit log viewer (F-60, M8a-05). Filters live in the URL so a view is shareable. Admin and VA
 * both read (SECURITY 2.2); the data comes only from `audit_search`, never from `audit_log` itself.
 */
export default async function AuditLogPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind === 'sign_in') redirect('/sign-in');
  if (access.kind === 'second_factor') redirect('/staff/2fa');
  if (access.kind !== 'ok') forbidden();

  const params = await searchParams;
  const parsed = auditFiltersSchema.safeParse({
    tenant: first(params.tenant),
    actor: first(params.actor),
    action: first(params.action),
    from: first(params.from),
    to: first(params.to),
    page: first(params.page)
  });
  const ctx = { userId: access.user.id, role: access.role };
  const tenants = await listAuditTenantOptions(ctx);
  const tenantNames = new Map(tenants.map((t) => [t.id, t.name]));
  const result = parsed.success ? await searchAuditLog(ctx, parsed.data) : null;
  const f = parsed.success ? parsed.data : null;

  const pageHref = (page: number) => {
    const q = new URLSearchParams();
    for (const k of ['tenant', 'actor', 'action', 'from', 'to'] as const) {
      const v = f?.[k];
      if (v) q.set(k, v);
    }
    q.set('page', String(page));
    return `/admin/audit?${q.toString()}`;
  };

  return (
    <PageContainer
      pageTitle='Audit log'
      pageDescription='Who did what, when and from where, with before and after values. Append-only.'
    >
      <form method='get' className='mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5' role='search'>
        <div className='grid gap-1.5'>
          <Label htmlFor='audit-tenant'>Client</Label>
          <NativeSelect
            id='audit-tenant'
            name='tenant'
            defaultValue={first(params.tenant) ?? ''}
            className='w-full'
          >
            <option value=''>All clients</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='audit-actor'>User ID</Label>
          <Input
            id='audit-actor'
            name='actor'
            defaultValue={first(params.actor) ?? ''}
            placeholder='User UUID'
            autoComplete='off'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='audit-action'>Action</Label>
          <Input
            id='audit-action'
            name='action'
            defaultValue={first(params.action) ?? ''}
            placeholder='module.toggle'
            autoComplete='off'
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='audit-from'>From</Label>
          <Input id='audit-from' type='date' name='from' defaultValue={first(params.from) ?? ''} />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='audit-to'>To</Label>
          <Input id='audit-to' type='date' name='to' defaultValue={first(params.to) ?? ''} />
        </div>
        <div className='flex items-center gap-2 sm:col-span-2 lg:col-span-5'>
          <Button type='submit'>Apply filters</Button>
          <Link href='/admin/audit' className={buttonVariants({ variant: 'ghost' })}>
            Clear
          </Link>
        </div>
      </form>

      {!result ? (
        <p role='alert' className='text-destructive text-sm'>
          One of the filters is not valid. User ID must be a UUID and dates must be YYYY-MM-DD.
        </p>
      ) : result.rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No events match these filters.</p>
      ) : (
        <>
          <div
            className='overflow-x-auto rounded-lg border'
            role='region'
            aria-label='Audit log results'
            tabIndex={0}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope='col'>When</TableHead>
                  <TableHead scope='col'>Client</TableHead>
                  <TableHead scope='col'>User</TableHead>
                  <TableHead scope='col'>Action</TableHead>
                  <TableHead scope='col'>Entity</TableHead>
                  <TableHead scope='col'>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className='whitespace-nowrap tabular-nums'>
                      {formatWhen(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      {row.tenantId
                        ? (tenantNames.get(row.tenantId) ?? shortId(row.tenantId))
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <span title={row.actorUserId ?? undefined}>{shortId(row.actorUserId)}</span>
                      {row.impersonatorUserId ? (
                        <span
                          className='text-muted-foreground block text-xs'
                          title={row.impersonatorUserId}
                        >
                          via {shortId(row.impersonatorUserId)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>{row.action}</TableCell>
                    <TableCell>
                      {row.entity}
                      {row.entityId ? (
                        <span className='text-muted-foreground block text-xs'>
                          {shortId(row.entityId)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className='min-w-40'>
                      <Detail row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <nav aria-label='Audit log pages' className='mt-4 flex items-center gap-3 text-sm'>
            {result.page > 1 ? (
              <Link href={pageHref(result.page - 1)} className='text-primary hover:underline'>
                Previous
              </Link>
            ) : null}
            <span className='text-muted-foreground'>
              {(result.page - 1) * AUDIT_PAGE_SIZE + 1}-
              {(result.page - 1) * AUDIT_PAGE_SIZE + result.rows.length}
            </span>
            {result.hasNext && result.page < 20 ? (
              <Link href={pageHref(result.page + 1)} className='text-primary hover:underline'>
                Next
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </PageContainer>
  );
}
