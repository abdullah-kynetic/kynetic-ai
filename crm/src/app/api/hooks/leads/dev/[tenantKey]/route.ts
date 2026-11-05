import { devLeadIntakeResponse } from '@/server/leads/dev-intake';
export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantKey: string }> }
) {
  return devLeadIntakeResponse(request, (await params).tenantKey);
}
