import { NextResponse } from 'next/server';
import { agencyCaller } from '@/app/admin/agency/caller';
import { agencyFinanceCsv, getAgencyFinance } from '@/server/agency/finance';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

const tabs = ['revenue', 'expenses', 'referrals', 'case-studies'] as const;

export const GET = withApi(async (request) => {
  const tab = new URL(request.url).searchParams.get('tab');
  if (!tabs.includes(tab as (typeof tabs)[number]))
    throw new AppError('VALIDATION_FAILED', { message: 'Choose a finance tab to export.' });
  const caller = await agencyCaller();
  const data = await getAgencyFinance(caller);
  const body = agencyFinanceCsv(tab as (typeof tabs)[number], data);
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="agency-${tab}.csv"`
    }
  });
});
