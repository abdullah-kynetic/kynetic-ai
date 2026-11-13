import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { getCompanyDetail } from '@/server/companies';
import { listFieldDefs } from '@/server/custom-fields';
import { NotFoundError } from '@/server/contacts';
import { uuidSchema } from '@/server/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { companiesContext } from '../_lib/context';
import { updateCompanyAction } from '../actions';
import { CompanyForm, type CompanyFormValues } from '../company-form';
import { DeleteCompany } from '../delete-company';

export const metadata: Metadata = { title: 'Company' };
export const dynamic = 'force-dynamic';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
});
const money = (cents: number) => usd.format(cents / 100);

const str = (v: unknown) => (typeof v === 'string' ? v : '');

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A malformed id is just a page that does not exist.
  if (!uuidSchema.safeParse(id).success) notFound();
  const ctx = await companiesContext();
  const detail = await getCompanyDetail(ctx, id).catch((e: unknown) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { company, rollup, contacts, deals } = detail;
  const customDefs = await listFieldDefs(ctx, 'company');
  const customValues = (company.custom ?? {}) as Record<string, unknown>;
  const address = company.address as Record<string, unknown>;
  const initial: CompanyFormValues = {
    name: company.name,
    phone: company.phoneE164 ?? '',
    website: company.website ?? '',
    line1: str(address.line1),
    city: str(address.city),
    state: str(address.state),
    postalCode: str(address.postalCode)
  };
  const stats = [
    { label: 'Contacts', value: String(rollup.contactCount) },
    { label: 'Deals', value: String(rollup.dealCount) },
    { label: 'Total deal value', value: money(rollup.totalValueCents) },
    { label: 'Open', value: money(rollup.openValueCents) },
    { label: 'Won', value: money(rollup.wonValueCents) }
  ];

  return (
    <PageContainer
      pageTitle={company.name}
      pageDescription={
        [company.phoneE164, company.website].filter(Boolean).join(' · ') || 'Company'
      }
      pageHeaderAction={
        <Link href='/dashboard/companies' className={buttonVariants({ variant: 'outline' })}>
          All companies
        </Link>
      }
    >
      <div className='space-y-6'>
        <section aria-label='Roll-up' className='grid grid-cols-2 gap-3 md:grid-cols-5'>
          {stats.map((s) => (
            <Card key={s.label} size='sm'>
              <CardHeader>
                <CardTitle className='text-muted-foreground text-xs font-medium'>
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent className='font-display text-2xl font-semibold tabular-nums'>
                {s.value}
              </CardContent>
            </Card>
          ))}
        </section>

        <section aria-labelledby='contacts-h'>
          <h2 id='contacts-h' className='mb-2 text-lg font-semibold'>
            Contacts
          </h2>
          {contacts.length === 0 ? (
            <p className='text-muted-foreground text-sm'>No contacts are linked to this company.</p>
          ) : (
            <Table scrollLabel='Contacts at this company'>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className='font-medium'>
                      {[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                    </TableCell>
                    <TableCell>{c.primaryPhoneE164 ?? '—'}</TableCell>
                    <TableCell>{c.primaryEmail ?? '—'}</TableCell>
                    <TableCell className='capitalize'>{c.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section aria-labelledby='deals-h'>
          <h2 id='deals-h' className='mb-2 text-lg font-semibold'>
            Deals
          </h2>
          {deals.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              None of this company&apos;s contacts are on a deal yet.
            </p>
          ) : (
            <Table scrollLabel='Deals at this company'>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className='text-end'>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className='font-medium'>{d.title}</TableCell>
                    <TableCell>{d.stage}</TableCell>
                    <TableCell className='text-end tabular-nums'>{money(d.valueCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section aria-labelledby='edit-h' className='max-w-2xl'>
          <h2 id='edit-h' className='mb-2 text-lg font-semibold'>
            Details
          </h2>
          <CompanyForm
            action={updateCompanyAction.bind(null, company.id)}
            initial={initial}
            customDefs={customDefs}
            customValues={customValues}
            submitLabel='Save changes'
          />
          <div className='mt-8 border-t pt-4'>
            <DeleteCompany id={company.id} name={company.name} />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
