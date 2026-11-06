import { agencyDate, agencyBillingCycle } from '@/components/agency/format';
import Link from 'next/link';
import PageContainer, { AgencyEmptyState, AgencyStatus } from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { agencyCaller } from '../caller';
import { getAgencyWorkspace, listAgencyLeads } from '@/server/agency';
import { getAgencyBilling } from '@/server/agency/billing';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import {
  saveTermsAction,
  createInvoiceAction,
  dunningAction,
  simulateInvoiceAction
} from './actions';
export const dynamic = 'force-dynamic';
const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export default async function AgencyBilling({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const caller = await agencyCaller();
  if (!(await getAgencyWorkspace(caller)))
    return <AgencyWorkspaceMissing pageTitle='Agency billing' />;
  const [{ leads }, data, q] = await Promise.all([
    listAgencyLeads(caller),
    getAgencyBilling(caller),
    searchParams
  ]);
  const deals = leads.flatMap((l) => (l.deal ? [{ id: l.deal.dealId, name: l.firstName }] : []));
  return (
    <PageContainer
      pageTitle='Agency billing'
      pageDescription='Custom USD deal terms, invoice drafts and reminder drafts. No live Stripe charges or delivery.'
    >
      <Link href='/admin/agency'>Agency dashboard</Link>
      {q.error && (
        <p role='alert'>
          Check the amounts and installment total. Invoice periods cannot be recreated with
          different terms.
        </p>
      )}
      <div className='agency-columns'>
        <form action={saveTermsAction} className='agency-form'>
          <h2 className='font-semibold'>Deal pricing</h2>
          <label>
            Deal
            <select name='dealId' required>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor='billing-setup'>
            Setup fee (USD)
            <Input
              id='billing-setup'
              name='setup'
              required
              placeholder='Enter agreed fee'
              inputMode='decimal'
            />
          </label>
          <label htmlFor='billing-monthly'>
            Optional monthly fee (USD)
            <Input id='billing-monthly' name='monthly' inputMode='decimal' />
          </label>
          <label htmlFor='billing-installments'>
            Optional setup installments (USD, comma separated)
            <Input
              id='billing-installments'
              name='installments'
              placeholder='Amounts must total the setup fee'
            />
          </label>
          <Button type='submit' disabled={!deals.length}>
            Save deal terms
          </Button>
        </form>

        <form action={createInvoiceAction} className='agency-form'>
          <h2 className='font-semibold'>Create invoice draft</h2>
          <label>
            Deal
            <select name='dealId' required>
              {data.terms.map((t) => (
                <option key={t.deal_id} value={t.deal_id}>
                  {deals.find((d) => d.id === t.deal_id)?.name ?? 'Deal'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fee
            <select name='kind'>
              <option value='setup'>Setup</option>
              <option value='monthly'>Monthly</option>
            </select>
          </label>
          <label htmlFor='billing-installment'>
            Setup installment number
            <select id='billing-installment' name='installment' defaultValue='0'>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index}>
                  Installment {index + 1}
                </option>
              ))}
            </select>
          </label>
          <p className='text-sm'>
            Choose the first installment when the setup fee is paid in full.
          </p>
          <label htmlFor='billing-period'>
            Monthly billing period
            <Input id='billing-period' name='period' type='month' />
          </label>
          <label htmlFor='billing-dueOn'>
            Due date
            <Input id='billing-dueOn' name='dueOn' type='date' required />
          </label>
          <Button type='submit' disabled={!data.terms.length}>
            Create draft
          </Button>
        </form>
      </div>
      <section>
        <h2 className='font-semibold'>Agreed draft terms</h2>
        {data.terms.map((t) => (
          <p key={t.deal_id}>
            {deals.find((d) => d.id === t.deal_id)?.name ?? 'Deal'}: {usd(t.setup_cents)} setup;{' '}
            {t.monthly_cents ? `${usd(t.monthly_cents)} / month` : 'No recurring fee'}; installments{' '}
            {t.installments.map(usd).join(', ') || 'None'}
          </p>
        ))}
      </section>
      <section className='agency-ledger my-8 space-y-3'>
        <h2 className='font-semibold'>Invoices — stub ledger</h2>
        {!data.invoices.length && (
          <AgencyEmptyState
            title='No invoice drafts yet'
            description='Save deal terms, then create a setup or monthly invoice draft. No payment is collected.'
          />
        )}
        {data.invoices.map((i) => (
          <article key={i.id} className='agency-panel space-y-4'>
            <p>
              {agencyBillingCycle(i.cycle_key)} · <strong>{usd(i.amount_cents)}</strong> ·{' '}
              <AgencyStatus value={i.status} /> · Due{' '}
              <time dateTime={String(i.due_on)}>{agencyDate(String(i.due_on))}</time>
            </p>
            <div className='flex flex-wrap gap-3'>
              {(['invoice.finalized', 'invoice.paid', 'invoice.payment_failed'] as const).map(
                (type) => (
                  <form
                    key={type}
                    action={simulateInvoiceAction.bind(null, i.id, i.amount_cents, type)}
                  >
                    <Button type='submit' variant='outline'>
                      Simulate {type.replace('invoice.', '').replaceAll('_', ' ')}
                    </Button>
                  </form>
                )
              )}
            </div>
          </article>
        ))}
      </section>
      <section className='my-6 space-y-3'>
        <h2 className='font-semibold'>Overdue reminder drafts</h2>
        <form action={dunningAction}>
          <Button type='submit' variant='outline'>
            Draft overdue reminders
          </Button>
        </form>
        {data.reminders.map((d) => (
          <p key={d.id}>{d.body}</p>
        ))}
        <p>Review drafts before any future manual delivery. Nothing is sent or charged.</p>
      </section>
    </PageContainer>
  );
}
