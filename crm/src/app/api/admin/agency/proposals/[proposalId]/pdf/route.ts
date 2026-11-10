import { NextResponse } from 'next/server';
import { agencyCaller } from '@/app/admin/agency/caller';
import { exportAgencyProposal } from '@/server/proposals';
import { withApi } from '@/server/security/with-api';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  async (_request, { params }: { params: Promise<{ proposalId: string }> }) => {
    const { proposalId } = await params;
    const bytes = await exportAgencyProposal(await agencyCaller(), proposalId);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': 'attachment; filename="kynetic-proposal.pdf"'
      }
    });
  }
);
