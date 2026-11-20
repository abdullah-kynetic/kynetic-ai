import { SettingsPage } from '../settings-page';
import { can, requireUser, resolveActor } from '@/server/auth';
import { getBranding, logoUrl } from '@/server/branding';
import { loadShellContext } from '@/server/shell';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BrandingForm } from './branding-form';

export const metadata = { title: 'Branding' };

export default async function BrandingPage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(
    requestHeaders,
    cookieStore.get('tenant_id')?.value,
    undefined,
    cookieStore.get(VIEW_AS_COOKIE)?.value
  );
  if (!shell?.tenant) redirect('/sign-in');
  if (shell.viewAs?.readOnly) {
    return (
      <SettingsPage pageTitle='Branding' access={false} accessFallback='This view is read-only.'>
        {null}
      </SettingsPage>
    );
  }
  const user = await requireUser(requestHeaders);
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, 'settings.business', shell.tenant.id)) {
    return (
      <SettingsPage
        pageTitle='Branding'
        access={false}
        accessFallback='Only the account owner can change branding.'
      >
        {null}
      </SettingsPage>
    );
  }
  const branding = await getBranding({
    tenantId: shell.tenant.id,
    userId: user.id,
    role: shell.role
  });
  return (
    <SettingsPage
      pageTitle='Branding'
      pageDescription='Choose the business name, logo and color your team sees in the portal'
    >
      <BrandingForm
        initial={{
          name: branding.name,
          primaryColor: branding.primaryColor ?? '',
          logoUrl: logoUrl(branding.logoKey)
        }}
      />
    </SettingsPage>
  );
}
