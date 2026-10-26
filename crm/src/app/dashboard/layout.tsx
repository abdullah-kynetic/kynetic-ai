import KBar from '@/components/kbar';
import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { ModulesProvider } from '@/components/modules/module-gate';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { loadShellContext, roleLabel } from '@/server/shell';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');

  const defaultOpen = cookieStore.get('sidebar_state')?.value !== 'false';
  return (
    <ModulesProvider modules={shell.modules}>
      <KBar>
        <SidebarProvider defaultOpen={defaultOpen}>
          <a
            href='#main-content'
            className='bg-background ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:ring-2'
          >
            Skip to content
          </a>
          <AppSidebar tenant={shell.tenant} />
          <SidebarInset id='main-content' tabIndex={-1} className='scroll-mt-16'>
            <Header user={{ ...shell.user, roleLabel: roleLabel(shell.role) }} />
            {children}
          </SidebarInset>
        </SidebarProvider>
      </KBar>
    </ModulesProvider>
  );
}
