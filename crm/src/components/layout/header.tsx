import React from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { Separator } from '../ui/separator';
import { Breadcrumbs } from '../breadcrumbs';
import SearchInput from '../search-input';
import { UserMenu, type ShellUser } from './user-menu';
import { NotificationBell } from '../notifications/notification-bell';
import { ThemeModeToggle } from '../themes/theme-mode-toggle';

export default function Header({ user }: { user: ShellUser }) {
  return (
    <header className='bg-background sticky top-(--view-as-h,0px) z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b md:h-14'>
      <div className='flex items-center gap-2 px-4'>
        <SidebarTrigger className='-ml-1' />
        <Separator orientation='vertical' className='mr-2 h-4 data-vertical:self-center' />
        <Breadcrumbs />
      </div>

      <div className='flex items-center gap-2 px-4'>
        <div className='hidden md:flex'>
          <SearchInput />
        </div>
        <NotificationBell />
        <ThemeModeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
