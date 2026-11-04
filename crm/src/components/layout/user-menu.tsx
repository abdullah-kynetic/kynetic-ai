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

export type ShellUser = { name: string | null; email: string; roleLabel: string };

export function UserMenu({
  user,
  showPersonas = false
}: {
  user: ShellUser;
  showPersonas?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='secondary' size='icon' />}
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
        {showPersonas && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className='text-muted-foreground text-xs'>View as</DropdownMenuLabel>
            {(
              [
                ['admin', 'Kynetic admin'],
                ['va', 'Kynetic support'],
                ['owner', 'Client owner'],
                ['staff', 'Client team member']
              ] as const
            ).map(([key, label]) => (
              <DropdownMenuItem key={key} onClick={() => window.location.assign(`/open/${key}`)}>
                {label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
