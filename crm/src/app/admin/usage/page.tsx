/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- scrollable table regions must be keyboard focusable (WCAG 2.1.1) */
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess, listUsageMonth } from '@/server/admin';
import {
  capStatus,
  capStatusLabel,
  formatCents,
  marginCents,
  minutesLabel,
  providerCostCents
} from '@/server/usage';

export const dynamic = 'force-dynamic';

export default async function UsagePage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const query = await searchParams;
  const { month, rows } = await listUsageMonth(
    { userId: access.user.id, role: access.role },
    query.month
  );
  const empty = rows.every(
    (row) => row.callCount === 0 && row.smsCount === 0 && row.emailCount === 0
  );
  return (
    <PageContainer
      pageTitle='Usage'
      pageDescription='Minutes, messages, provider cost, and the fee already recorded for each client. Clients do not see this page.'
    >
      <form className='mb-4 flex flex-wrap items-end gap-3' method='get'>
        <label className='grid gap-1 text-sm'>
          Month
          <input
            className='min-h-11 rounded border px-3'
            name='month'
            type='month'
            defaultValue={month}
          />
        </label>
        <button className='min-h-11 rounded border px-3' type='submit'>
          Show month
        </button>
        <a
          className='inline-flex min-h-11 items-center underline'
          href={`/admin/usage/export?month=${month}`}
        >
          Download CSV
        </a>
      </form>
      {empty ? <p>No usage recorded for {month}.</p> : null}
      <div
        className='overflow-x-auto rounded-lg border'
        role='region'
        aria-label='Usage by client'
        tabIndex={0}
      >
        <table className='w-full text-sm'>
          <thead>
            <tr>
              <th className='p-3 text-start'>Client</th>
              <th className='p-3 text-start'>Minutes</th>
              <th className='p-3 text-start'>Calls</th>
              <th className='p-3 text-start'>SMS</th>
              <th className='p-3 text-start'>Emails</th>
              <th className='p-3 text-start'>Provider cost</th>
              <th className='p-3 text-start'>Recorded fee</th>
              <th className='p-3 text-start'>Margin</th>
              <th className='p-3 text-start'>Cap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const margin = marginCents(row);
              return (
                <tr key={row.tenantId} className='border-t'>
                  <td className='p-3'>{row.tenantName}</td>
                  <td className='p-3'>{minutesLabel(row.callSeconds)}</td>
                  <td className='p-3'>{row.callCount}</td>
                  <td className='p-3'>{row.smsCount}</td>
                  <td className='p-3'>{row.emailCount}</td>
                  <td className='p-3'>
                    {formatCents(providerCostCents(row))}
                    {row.costUnknown ? ' · cost unknown' : ''}
                  </td>
                  <td className='p-3'>
                    {row.monthlyFeeCents == null
                      ? 'Not recorded'
                      : formatCents(row.monthlyFeeCents)}
                  </td>
                  <td className='p-3'>{margin == null ? 'Not recorded' : formatCents(margin)}</td>
                  <td className='p-3'>{capStatusLabel(capStatus(row))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
