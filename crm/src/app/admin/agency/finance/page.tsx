import Link from 'next/link';
import PageContainer, { AgencyEmptyState } from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAgencyWorkspace, listAgencyLeads } from '@/server/agency';
import { getAgencyFinance } from '@/server/agency/finance';
import { listAdminTenantOverview } from '@/server/admin/overview';
import { agencyCaller } from '../caller';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import {
  addExpenseAction,
  addReferralAction,
  addRevenueAction,
  approveReferralAction,
  deleteExpenseAction,
  editExpenseAction,
  saveCaseStudyAction
} from './actions';

export const dynamic = 'force-dynamic';
const tabs = [
  ['revenue', 'Revenue'],
  ['expenses', 'Expenses'],
  ['referrals', 'Referrals'],
  ['case-studies', 'Case studies']
] as const;
const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default async function FinancePage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const caller = await agencyCaller();
  if (!(await getAgencyWorkspace(caller))) return <AgencyWorkspaceMissing pageTitle='Finance' />;
  const query = await searchParams;
  const tab = tabs.some(([id]) => id === query.tab) ? query.tab! : 'revenue';
  const [data, { leads }, clients] = await Promise.all([
    getAgencyFinance(caller),
    listAgencyLeads(caller),
    listAdminTenantOverview({ userId: caller.id, role: 'admin' })
  ]);
  return (
    <PageContainer
      pageTitle='Finance'
      pageDescription='Revenue, expenses, referrals and case studies for the agency workspace. Nothing is sent.'
    >
      <Link href='/admin/agency'>Agency dashboard</Link>
      <p className='my-3'>
        This month (Pacific): revenue {usd(data.summary.revenueCents)}, expenses{' '}
        {usd(data.summary.expenseCents)}, net {usd(data.summary.netCents)}.
      </p>
      {query.error && <p role='alert'>Check the amount, date and link, then try again.</p>}
      <nav aria-label='Finance tabs' className='my-4 flex flex-wrap gap-3'>
        {tabs.map(([id, label]) => (
          <Link
            key={id}
            href={`/admin/agency/finance?tab=${id}`}
            aria-current={tab === id ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p>
        <a href={`/api/admin/agency/finance/export?tab=${tab}`}>Download CSV</a>
      </p>
      {tab === 'revenue' && (
        <section className='mt-6 space-y-4'>
          <h2 className='font-semibold'>Monthly revenue</h2>
          {!data.months.length && (
            <AgencyEmptyState
              title='No revenue yet'
              description='Won deals and manual entries show here. Amounts are the values already stored.'
            />
          )}
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Won deals</th>
                <th>Manual</th>
                <th>Revenue</th>
                <th>Expenses</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((month) => (
                <tr key={month.month}>
                  <td>{month.month}</td>
                  <td>{usd(month.wonCents)}</td>
                  <td>{usd(month.manualCents)}</td>
                  <td>{usd(month.revenueCents)}</td>
                  <td>{usd(month.expenseCents)}</td>
                  <td>{usd(month.netCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={addRevenueAction} className='agency-form max-w-xl'>
            <h3 className='font-semibold'>Manual revenue</h3>
            <Label htmlFor='revenue-date'>Date</Label>
            <Input id='revenue-date' name='receivedOn' type='date' required />
            <Label htmlFor='revenue-amount'>Amount (USD)</Label>
            <Input id='revenue-amount' name='amount' inputMode='decimal' required />
            <Label htmlFor='revenue-note'>Note</Label>
            <Input id='revenue-note' name='note' maxLength={2000} />
            <Button type='submit'>Add revenue</Button>
          </form>
        </section>
      )}
      {tab === 'expenses' && (
        <section className='mt-6 space-y-4'>
          <h2 className='font-semibold'>Expenses</h2>
          {!data.expenses.length && (
            <AgencyEmptyState
              title='No expenses yet'
              description='Add a vendor cost. Deleted rows stay in the audit log and drop out of the totals.'
            />
          )}
          {data.expenses.map((expense) => (
            <form
              key={expense.id}
              action={editExpenseAction.bind(null, expense.id)}
              className='flex flex-wrap gap-2'
            >
              <Input
                name='spentOn'
                type='date'
                defaultValue={expense.spentOn}
                required
                aria-label='Date'
              />
              <Input name='vendor' defaultValue={expense.vendor} required aria-label='Vendor' />
              <Input
                name='category'
                defaultValue={expense.category}
                required
                aria-label='Category'
              />
              <Input
                name='amount'
                defaultValue={(expense.amountCents / 100).toFixed(2)}
                required
                aria-label='Amount'
              />
              <Input name='note' defaultValue={expense.note} aria-label='Note' />
              <Button type='submit' variant='outline'>
                Save
              </Button>
              <button formAction={deleteExpenseAction.bind(null, expense.id)}>Delete</button>
            </form>
          ))}
          <form action={addExpenseAction} className='agency-form max-w-xl'>
            <h3 className='font-semibold'>Add expense</h3>
            <Input name='spentOn' type='date' required aria-label='Date' />
            <Input
              name='vendor'
              required
              maxLength={200}
              aria-label='Vendor'
              placeholder='Vendor'
            />
            <Input
              name='category'
              required
              maxLength={80}
              aria-label='Category'
              placeholder='Category'
            />
            <Input
              name='amount'
              required
              inputMode='decimal'
              aria-label='Amount in USD'
              placeholder='Amount'
            />
            <Input name='note' maxLength={2000} aria-label='Note' placeholder='Note' />
            <Button type='submit'>Add expense</Button>
          </form>
        </section>
      )}
      {tab === 'referrals' && (
        <section className='mt-6 space-y-4'>
          <h2 className='font-semibold'>Referrals</h2>
          {!data.referrals.length && (
            <AgencyEmptyState
              title='No referrals yet'
              description='Record who referred a lead and approve the reward yourself. No message is sent.'
            />
          )}
          {data.referrals.map((referral) => (
            <article key={referral.id} className='rounded border p-3'>
              <p>
                {referral.referrerName}
                {referral.contactName ? ` · ${referral.contactName}` : ''} · {referral.status}
              </p>
              <p>{referral.rewardNote}</p>
              {referral.status !== 'approved' && (
                <form action={approveReferralAction.bind(null, referral.id)}>
                  <Button type='submit' variant='outline'>
                    Approve
                  </Button>
                </form>
              )}
            </article>
          ))}
          <form action={addReferralAction} className='agency-form max-w-xl'>
            <Label htmlFor='referrer-name'>Referrer</Label>
            <Input id='referrer-name' name='referrerName' required maxLength={200} />
            <label>
              Referred lead
              <select name='contactId'>
                <option value=''>None</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.firstName}
                  </option>
                ))}
              </select>
            </label>
            <Label htmlFor='reward-note'>Reward note</Label>
            <Input id='reward-note' name='rewardNote' maxLength={2000} />
            <Button type='submit'>Add referral</Button>
          </form>
        </section>
      )}
      {tab === 'case-studies' && (
        <section className='mt-6 space-y-4'>
          <h2 className='font-semibold'>Case studies</h2>
          {!data.studies.length && (
            <AgencyEmptyState
              title='No case studies yet'
              description='Track an idea through published. The note is a placeholder until the story is written.'
            />
          )}
          {data.studies.map((study) => (
            <article key={study.id}>
              <p>
                {study.clientName ?? 'No client linked'} · {study.status}
                {study.url ? ` · ${study.url}` : ''}
              </p>
              <p>{study.note}</p>
            </article>
          ))}
          <form action={saveCaseStudyAction} className='agency-form max-w-xl'>
            <label>
              Client
              <select name='clientTenantId'>
                <option value=''>None yet</option>
                {clients.map((client) => (
                  <option key={client.tenantId} value={client.tenantId}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name='status' defaultValue='idea'>
                {['idea', 'drafting', 'approved', 'published'].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <Label htmlFor='case-url'>URL</Label>
            <Input id='case-url' name='url' type='url' placeholder='https://' />
            <Label htmlFor='case-note'>Note</Label>
            <Input id='case-note' name='note' maxLength={2000} />
            <Button type='submit'>Save case study</Button>
          </form>
        </section>
      )}
    </PageContainer>
  );
}
