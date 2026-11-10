import { NextResponse } from 'next/server';
import { agencyCaller } from '@/app/admin/agency/caller';
import { getAgencyContractFileUrl } from '@/server/agency/contracts';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (_request, { params }: { params: Promise<{ contractId: string }> }) => {
    const { contractId } = await params;
    const { url } = await getAgencyContractFileUrl(await agencyCaller(), contractId);
    return NextResponse.redirect(url, { status: 302 });
  }
);
