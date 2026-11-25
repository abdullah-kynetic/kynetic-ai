import type { ReactNode } from 'react';
import { PortalPageContainer } from '@/components/layout/page-container';
import type { TenantContextInput } from '@/server/tenancy';
import { hasShopDemoData } from '@/server/shop';
import { DemoDataBanner } from './demo-banner';

/**
 * The frame every shop screen uses: portal page header, the Demo data banner while sample rows exist,
 * then the page. Phone width: one column with the portal's own 16 px gutter.
 */
export async function ShopPage({
  ctx,
  title,
  description,
  actions,
  children
}: {
  ctx: TenantContextInput;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const demo = await hasShopDemoData(ctx);
  return (
    <PortalPageContainer pageTitle={title} pageDescription={description} pageHeaderAction={actions}>
      <div className='flex min-w-0 flex-col gap-6'>
        {demo ? <DemoDataBanner /> : null}
        {children}
      </div>
    </PortalPageContainer>
  );
}
