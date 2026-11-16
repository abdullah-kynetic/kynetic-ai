import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { ModulesProvider } from '@/components/modules/module-gate';
import { StaticWorkspaceCard } from '@/components/workspace/workspace-card';
import { WorkspaceSwitcher } from '@/components/workspace/workspace-switcher';
import { toWorkspaces } from '@/lib/workspaces';
import { listAdminTenantOverview } from '@/server/admin';
import { AGENCY_SYNTHETIC_SLUG } from '@/server/agency/constants';
import { DEMO_CLIENT_PROFILES } from '@/server/db/seed/demo-client-profiles';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { adminNavGroups } from '@/config/nav-config';
import { visibleNavGroups } from '@/config/nav-registry';
import { decideAdminAccess } from '@/server/admin';
import { resolveViewAs, VIEW_AS_COOKIE } from '@/server/impersonation';
import { roleLabel } from '@/server/shell';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { forbidden, redirect, unauthorized } from 'next/navigation';

export const metadata: Metadata = {
  title: { default: 'Admin | Kynetic', template: '%s | Kynetic' },
  robots: { index: false, follow: false }
};
export const dynamic = 'force-dynamic';

/**
 * The admin side shell (F-53 shell, M8a-01). One guard for every `/admin/*` route: Kynetic role,
 * TOTP passed, current Terms accepted. Pages still authorize their own actions (SECURITY 2.2).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const access = await decideAdminAccess(requestHeaders);
  if (access.kind === 'sign_in') unauthorized();
  if (access.kind === 'forbidden') forbidden();
  if (access.kind === 'second_factor') redirect('/staff/2fa');
  // Impersonation cannot reach the admin side (SECURITY 2.6): exit first.
  const viewAs = await resolveViewAs({
    user: access.user,
    cookie: cookieStore.get(VIEW_AS_COOKIE)?.value,
    touch: false
  });
  if (viewAs.kind === 'active') redirect('/dashboard');

  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';
  const { user, role } = access;
  const groups = visibleNavGroups(
    adminNavGroups,
    { keys: new Set(['platform']), crmLevel: null },
    role
  );
  // The switcher lists every client, so it is for the admin role only; support staff get a plain card.
  const workspaces =
    role === 'admin'
      ? toWorkspaces(await listAdminTenantOverview({ userId: user.id, role: 'admin' }), {
          demoSlugs: new Set(DEMO_CLIENT_PROFILES.map((p) => p.slug)),
          hiddenSlugs: new Set([AGENCY_SYNTHETIC_SLUG])
        })
      : null;
  const roleText = roleLabel(role);
  return (
    // The admin side is platform-only and takes no tenant (DESIGN_SYSTEM: Kynetic orange chrome).
    <ModulesProvider modules={{ keys: ['platform'], crmLevel: null }}>
      <KBar groups={groups}>
        <SidebarProvider defaultOpen={defaultOpen}>
          <a
            href='#main-content'
            className='bg-background ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:ring-2'
          >
            Skip to content
          </a>
          <AppSidebar
            groups={groups}
            workspace={
              workspaces ? (
                <WorkspaceSwitcher workspaces={workspaces} />
              ) : (
                <StaticWorkspaceCard name='Kynetic AI' detail='Support' />
              )
            }
            footerLinks={[{ title: 'Help', url: '/admin/support', icon: 'help' }]}
            user={{ name: user.name, email: user.email, roleLabel: roleText }}
          />
          <SidebarInset id='main-content' tabIndex={-1} className='scroll-mt-16'>
            <Header user={{ name: user.name, email: user.email, roleLabel: roleText }} />
            {children}
          </SidebarInset>
        </SidebarProvider>
      </KBar>
    </ModulesProvider>
  );
}
