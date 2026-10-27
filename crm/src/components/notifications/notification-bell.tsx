'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationRow } from './notification-row';
import { unreadLabel, useNotifications } from './use-notifications';

const POPOVER_LIMIT = 8;

/** Top-bar bell (F-35): unread badge capped at "99+", popover with the latest items, link to the page. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data, isPending, isError, refetch } = useNotifications('all', POPOVER_LIMIT);
  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant='secondary' size='icon' className='relative size-8' />}
        aria-label={`Notifications. ${unreadLabel(unread)}`}
      >
        <Icons.notification aria-hidden='true' />
        {unread > 0 && (
          <span
            aria-hidden='true'
            className='bg-primary text-primary-foreground absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold'
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 gap-1 p-2'>
        <div className='flex items-center justify-between px-3 py-1'>
          <h2 className='text-sm font-semibold'>Notifications</h2>
          <span role='status' className='text-muted-foreground text-xs'>
            {unreadLabel(unread)}
          </span>
        </div>
        <div className='max-h-96 overflow-y-auto'>
          {isPending && (
            <p role='status' className='text-muted-foreground px-3 py-6 text-center text-sm'>
              Loading...
            </p>
          )}
          {isError && (
            <div role='alert' className='flex flex-col items-center gap-2 px-3 py-6 text-sm'>
              <span>Could not load notifications.</span>
              <Button size='sm' variant='secondary' onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          )}
          {data && data.items.length === 0 && (
            <p className='text-muted-foreground px-3 py-6 text-center text-sm'>
              You're all caught up
            </p>
          )}
          {data?.items.map((item) => (
            <NotificationRow key={item.id} item={item} onOpen={() => setOpen(false)} />
          ))}
        </div>
        <Link
          href='/dashboard/notifications'
          onClick={() => setOpen(false)}
          className='hover:bg-muted focus-visible:ring-ring rounded-md px-3 py-2 text-center text-sm font-medium focus-visible:ring-2 focus-visible:outline-none'
        >
          View all
        </Link>
      </PopoverContent>
    </Popover>
  );
}
