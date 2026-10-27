import PageContainer from '@/components/layout/page-container';
import { Icons } from '@/components/icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { listCompanies } from '@/server/companies';
import type { Metadata } from 'next';
import Link from 'next/link';
import { companiesContext } from './_lib/context';

export const metadata: Metadata = { title: 'Companies' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CompaniesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await companiesContext();
  const sp = await searchParams;
  const q = first(sp.q)?.trim().slice(0, 200) || undefined;
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? '1', 10) || 1);
  const { items, total } = await listCompanies(ctx, {
    q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/dashboard/companies${qs ? `?${qs}` : ''}`;
  };

  return (
    <PageContainer
      pageTitle='Companies'
      pageDescription='Businesses and property managers your contacts work for.'
      pageHeaderAction={
        <Link href='/dashboard/companies/new' className={buttonVariants()}>
          <Icons.add className='size-4' aria-hidden /> Add company
        </Link>
      }
    >
      <form role='search' className='mb-4 flex max-w-md gap-2' action='/dashboard/companies'>
        <Input
          name='q'
          type='search'
          defaultValue={q ?? ''}
          placeholder='Search companies'
          aria-label='Search companies'
        />
        <Button type='submit' variant='outline'>
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title={q ? 'No companies match' : 'No companies yet'}
          description={
            q
              ? 'Try a different name.'
              : 'Add a company to group the contacts and deals that belong to it.'
          }
          action={
            q ? (
              <Link href='/dashboard/companies' className={buttonVariants({ variant: 'outline' })}>
                Clear search
              </Link>
            ) : (
              <Link href='/dashboard/companies/new' className={buttonVariants()}>
                Add company
              </Link>
            )
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className='text-end'>Contacts</TableHead>
                <TableHead className='text-end'>Deals</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className='font-medium'>
                    <Link
                      href={`/dashboard/companies/${c.id}`}
                      className='text-primary-text underline-offset-4 hover:underline'
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.phoneE164 ?? '—'}</TableCell>
                  <TableCell className='text-end tabular-nums'>{c.contactCount}</TableCell>
                  <TableCell className='text-end tabular-nums'>{c.dealCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <nav aria-label='Pagination' className='mt-4 flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>
              {total} {total === 1 ? 'company' : 'companies'} · page {page} of {pages}
            </span>
            <span className='flex gap-2'>
              {page > 1 && (
                <Link href={href(page - 1)} className={buttonVariants({ variant: 'outline' })}>
                  Previous
                </Link>
              )}
              {page < pages && (
                <Link href={href(page + 1)} className={buttonVariants({ variant: 'outline' })}>
                  Next
                </Link>
              )}
            </span>
          </nav>
        </>
      )}
    </PageContainer>
  );
}
