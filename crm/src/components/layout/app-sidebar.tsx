'use client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { navGroups as clientNavGroups } from '@/config/nav-config';
import type { NavGroup } from '@/types';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icons } from '../icons';
import { useKBar } from 'kbar';
import { initials } from '@/lib/workspaces';

export type SidebarFooterLink = { title: string; url: string; icon: keyof typeof Icons };
export type SidebarUser = { name: string | null; email: string; roleLabel: string };

// Active item: a surface step with a hairline, and the accent only on its icon. Quiet chrome.
const ACTIVE_MARKER =
  'rounded-lg data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:shadow-[inset_0_0_0_1px_var(--sidebar-border)] data-active:[&>svg]:text-primary-text';

function SidebarSearch() {
  const { query } = useKBar();
  return (
    <button
      type='button'
      onClick={query.toggle}
      className='bg-card text-muted-foreground border-border hover:bg-card/70 focus-visible:ring-sidebar-ring flex min-h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none group-data-[collapsible=icon]:hidden'
    >
      <Icons.search aria-hidden className='size-4' />
      <span className='flex-1 text-left'>Search or jump to</span>
      <kbd aria-hidden className='bg-muted rounded px-1.5 font-mono text-[10px]'>
        ⌘K
      </kbd>
    </button>
  );
}

export default function AppSidebar({
  workspace,
  groups = clientNavGroups,
  role,
  footerLinks = [],
  user
}: {
  /** Static card for client users, the switcher for admins (rendered by the layout). */
  workspace: React.ReactNode;
  footerLinks?: SidebarFooterLink[];
  user: SidebarUser;
  /** The signed-in role, so owner-only entries hide for everyone else. */
  role?: string;
  /** Defaults to the client portal registry; the admin shell passes its own (M8a-01). */
  groups?: NavGroup[];
}) {
  const pathname = usePathname();
  const filteredGroups = useFilteredNavGroups(groups, role);
  const areaActive = (url: string) =>
    pathname === url ||
    (url !== '/admin' && url !== '/dashboard' && pathname.startsWith(`${url}/`));

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader className='gap-3 p-3 group-data-[collapsible=icon]:items-center'>
        <Link
          href='/'
          aria-label='Kynetic AI'
          className='focus-visible:ring-sidebar-ring rounded-md px-1 focus-visible:ring-2 focus-visible:outline-none'
        >
          {/* eslint-disable @next/next/no-img-element -- static brand SVGs */}
          <img
            src='/brand/wordmark-ink.svg'
            alt=''
            className='h-4 w-auto dark:hidden group-data-[collapsible=icon]:hidden'
          />
          <img
            src='/brand/wordmark-cream.svg'
            alt=''
            className='hidden h-4 w-auto dark:block group-data-[collapsible=icon]:hidden'
          />
          <img
            src='/brand/k-orange.svg'
            alt=''
            className='hidden size-6 group-data-[collapsible=icon]:block'
          />
          {/* eslint-enable @next/next/no-img-element */}
        </Link>
        {workspace}
        <SidebarSearch />
      </SidebarHeader>
      <SidebarContent className='overflow-x-hidden'>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label || 'ungrouped'} className='py-0'>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon ? Icons[item.icon] : Icons.logo;
                return item?.items && item?.items?.length > 0 ? (
                  <Collapsible
                    key={item.title}
                    defaultOpen={item.isActive}
                    render={<SidebarMenuItem />}
                  >
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={areaActive(item.url)}
                          className={`group/collapsible ${ACTIVE_MARKER}`}
                        />
                      }
                    >
                      {item.icon && <Icon />}
                      <span>{item.title}</span>
                      <Icons.chevronRight className='ml-auto transition-transform duration-200 group-data-panel-open/collapsible:rotate-90' />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              render={<Link href={subItem.url} aria-label={subItem.title} />}
                              isActive={pathname === subItem.url}
                            >
                              <span>{subItem.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} aria-label={item.title} />}
                      tooltip={item.title}
                      isActive={areaActive(item.url)}
                      className={ACTIVE_MARKER}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className='gap-1 p-3'>
        <SidebarMenu>
          {footerLinks.map((link) => {
            const Icon = Icons[link.icon];
            return (
              <SidebarMenuItem key={link.title}>
                <SidebarMenuButton
                  render={<Link href={link.url} aria-label={link.title} />}
                  tooltip={link.title}
                  isActive={pathname === link.url}
                  className={ACTIVE_MARKER}
                >
                  <Icon />
                  <span>{link.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <div
          data-slot='user-card'
          className='bg-card border-border flex items-center gap-2.5 rounded-lg border p-2 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0'
        >
          <span
            aria-hidden
            className='bg-secondary text-secondary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
          >
            {initials(user.name ?? user.email)}
          </span>
          <span className='flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden'>
            <span className='truncate text-sm font-medium'>{user.name ?? user.email}</span>
            <span className='text-muted-foreground truncate text-xs'>{user.roleLabel}</span>
          </span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
