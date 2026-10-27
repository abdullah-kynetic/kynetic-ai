import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { getTenantBilling } from '@/server/billing';
import { AppError } from '@/server/errors';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import { BillingPanel } from './billing-panel';

export const metadata: Metadata = { title: 'Billing' };
export const dynamic = 'force-dynamic';

// Plan, tier and agreed pricing for one client (F-86, F-99, M8a-07). Admin only: a VA, owner or staff user gets 403.
export default async function ClientBillingPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  let view: Awaited<ReturnType<typeof getTenantBilling>>;
  try {
    view = await getTenantBilling({ id: access.user.id, kyneticRole: access.role }, tenantId);
  } catch (e) {
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }
  return (
    <PageContainer
      pageTitle={`${view.tenant.name}: billing`}
      pageDescription='What this client agreed to pay. Records only: invoices are made in Stripe by hand.'
    >
      <BillingPanel view={view} />
    </PageContainer>
  );
}
