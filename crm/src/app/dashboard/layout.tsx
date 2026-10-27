import { adminEntryGroup, navGroups } from '@/config/nav-config';
import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { ModulesProvider } from '@/components/modules/module-gate';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { ViewAsProvider } from '@/components/view-as/view-as-context';
import { ViewAsBanner, VIEW_AS_BANNER_HEIGHT } from '@/components/view-as/view-as-banner';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { loadShellContext, roleLabel } from '@/server/shell';
import { pendingDocuments } from '@/server/terms';
import { brandingCss } from '@/lib/branding/color';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { CSSProperties } from 'react';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(
    requestHeaders,
    cookieStore.get('tenant_id')?.value,
    undefined,
    cookieStore.get(VIEW_AS_COOKIE)?.value
  );
  if (!shell) redirect('/sign-in');
  // F-102: nothing in the portal until the current Terms and Privacy Policy are accepted.
  if ((await pendingDocuments(shell.user.id)).length > 0) redirect('/accept-terms');

  // Only Kynetic staff are shown the way into the admin side; the admin routes check the role again.
  // Inside a view-as session the page is the client's, so there is no way into the admin side.
  const groups =
    (shell.role === 'admin' || shell.role === 'va') && !shell.viewAs
      ? [...navGroups, adminEntryGroup]
      : navGroups;
  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';
  const viewAs = shell.viewAs;
  return (
    <ModulesProvider modules={shell.modules}>
      {/* F-39: tenant color, server-rendered so there is no flash. Admin sessions keep Kynetic orange. */}
      {shell.tenant?.primaryColor && shell.role !== 'admin' && shell.role !== 'va' && (
        <style>{brandingCss(shell.tenant.primaryColor)}</style>
      )}
      <ViewAsProvider
        value={viewAs ? { tenantName: viewAs.tenantName, readOnly: viewAs.readOnly } : null}
      >
        <div
          style={viewAs ? ({ '--view-as-h': VIEW_AS_BANNER_HEIGHT } as CSSProperties) : undefined}
        >
          {viewAs && (
            <ViewAsBanner
              tenantName={viewAs.tenantName}
              adminName={shell.user.name ?? shell.user.email}
              readOnly={viewAs.readOnly}
              writeUntil={viewAs.writeUntil?.toISOString() ?? null}
              canWrite={shell.role === 'admin'}
            />
          )}
          <KBar groups={groups}>
            <SidebarProvider defaultOpen={defaultOpen}>
              <a
                href='#main-content'
                className='bg-background ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:ring-2'
              >
                Skip to content
              </a>
              <AppSidebar tenant={shell.tenant} groups={groups} />
              <SidebarInset id='main-content' tabIndex={-1} className='scroll-mt-16'>
                <Header user={{ ...shell.user, roleLabel: roleLabel(shell.role) }} />
                {children}
              </SidebarInset>
            </SidebarProvider>
          </KBar>
        </div>
      </ViewAsProvider>
    </ModulesProvider>
  );
}
