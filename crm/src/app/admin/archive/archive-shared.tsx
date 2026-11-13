import Link from 'next/link';
import { headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { ARCHIVE_PAGE_SIZE } from '@/server/archive';
import type { PlatformContext } from '@/server/tenancy';

export type SearchParams = Record<string, string | string[] | undefined>;
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Same gate as every /admin page: Kynetic role, TOTP done. Returns the staff context for the queries. */
export async function requireArchiveStaff(): Promise<PlatformContext> {
  const access = await decideAdminAccess(await headers());
  if (access.kind === 'sign_in') redirect('/sign-in');
  if (access.kind !== 'ok') forbidden();
  return { userId: access.user.id, role: access.role };
}

const TABS = [
  { href: '/admin/archive/notes', label: 'Notes' },
  { href: '/admin/archive/tasks', label: 'Tasks' },
  { href: '/admin/archive/attachments', label: 'Attachments' },
  { href: '/admin/archive/records', label: 'Records' }
];

export function ArchiveTabs({ current }: { current: string }) {
  return (
    <nav aria-label='Archive sections' className='mb-4 flex flex-wrap gap-2 text-sm'>
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? 'page' : undefined}
          className={
            t.href === current
              ? 'bg-primary text-primary-foreground rounded-md px-3 py-1.5'
              : 'hover:bg-muted rounded-md border px-3 py-1.5'
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function Pager({
  label,
  basePath,
  params,
  page,
  count,
  hasNext
}: {
  label: string;
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  count: number;
  hasNext: boolean;
}) {
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    q.set('page', String(p));
    return `${basePath}?${q.toString()}`;
  };
  return (
    <nav aria-label={label} className='mt-4 flex items-center gap-3 text-sm'>
      {page > 1 ? (
        <Link href={href(page - 1)} className='text-foreground underline underline-offset-2'>
          Previous
        </Link>
      ) : null}
      <span className='text-muted-foreground'>
        {(page - 1) * ARCHIVE_PAGE_SIZE + 1}-{(page - 1) * ARCHIVE_PAGE_SIZE + count}
      </span>
      {hasNext ? (
        <Link href={href(page + 1)} className='text-foreground underline underline-offset-2'>
          Next
        </Link>
      ) : null}
    </nav>
  );
}

export function Banner() {
  return (
    <p className='text-muted-foreground mb-4 text-sm'>
      Read-only copy of the old Twenty planning records, kept for reference. Nothing here can be
      edited or written back.
    </p>
  );
}
