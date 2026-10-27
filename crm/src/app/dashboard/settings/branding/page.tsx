import PageContainer from '@/components/layout/page-container';
import { can, requireUser, resolveActor } from '@/server/auth';
import { getBranding, logoUrl } from '@/server/branding';
import { loadShellContext } from '@/server/shell';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandingForm } from './branding-form';

export const metadata = { title: 'Branding' };

export default async function BrandingPage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell?.tenant) redirect('/sign-in');
  const user = await requireUser(requestHeaders);
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, 'settings.business', shell.tenant.id)) {
    return (
      <PageContainer pageTitle='Branding'>
        <p className='text-muted-foreground text-sm'>Only the account owner can change branding.</p>
      </PageContainer>
    );
  }
  const branding = await getBranding({
    tenantId: shell.tenant.id,
    userId: user.id,
    role: shell.role
  });
  return (
    <PageContainer
      pageTitle='Branding'
      pageDescription='Your logo, color and business name appear on every page. Layout and type stay the same.'
    >
      <BrandingForm
        initial={{
          name: branding.name,
          primaryColor: branding.primaryColor ?? '',
          logoUrl: logoUrl(branding.logoKey)
        }}
      />
    </PageContainer>
  );
}
