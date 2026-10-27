import { leadIntakeResponse } from '@/server/leads';

export const dynamic = 'force-dynamic';

// F-76. Signed with the tenant's secret (SECURITY 3.6); the Origin check does not apply to /api/hooks.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantKey: string }> }
) {
  const { tenantKey } = await params;
  return leadIntakeResponse(request, tenantKey);
}
