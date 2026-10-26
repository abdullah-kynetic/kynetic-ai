'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export type ShellUser = { name: string | null; email: string; roleLabel: string };

export function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  async function signOut() {
    await authClient.signOut();
    router.push('/sign-in');
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='secondary' size='icon' className='size-8' />}
        aria-label='Account menu'
      >
        <Icons.account />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-56'>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='flex flex-col gap-0.5'>
            <span className='text-foreground text-sm font-medium'>{user.name ?? user.email}</span>
            {user.name && <span className='text-muted-foreground text-xs'>{user.email}</span>}
            <span className='text-muted-foreground text-xs'>{user.roleLabel}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <Icons.logout />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
