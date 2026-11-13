'use client';

import { useState } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NOTIFICATION_TABS, type NotificationTab } from '@/server/notifications/tabs';
import { NotificationRow } from './notification-row';
import { unreadLabel, useMarkAllRead, useNotifications } from './use-notifications';

const PAGE_SIZE = 50;
const TAB_KEYS = Object.keys(NOTIFICATION_TABS) as NotificationTab[];

/** Full page with tabs (F-35). Empty: "You're all caught up". */
export function NotificationsPage() {
  const [tab, setTab] = useState<NotificationTab>('all');
  const { data, isPending, isError, refetch } = useNotifications(tab, PAGE_SIZE);
  const markAll = useMarkAllRead();
  const unread = data?.unread ?? 0;

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Tabs value={tab} onValueChange={(v) => setTab(v as NotificationTab)}>
          <TabsList
            variant='line'
            className='h-auto max-w-full flex-wrap'
            aria-label='Notification filters'
          >
            {TAB_KEYS.map((k) => (
              <TabsTrigger key={k} value={k}>
                {NOTIFICATION_TABS[k].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className='flex items-center gap-3'>
          <span role='status' className='text-muted-foreground text-sm'>
            {unreadLabel(unread)}
          </span>
          <Button
            variant='secondary'
            size='sm'
            disabled={unread === 0 || markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all as read
          </Button>
        </div>
      </div>

      {isPending && (
        <div role='status' aria-label='Loading notifications' className='flex flex-col gap-2'>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-14 w-full' />
          ))}
        </div>
      )}
      {isError && (
        <ErrorState message='Notifications could not be loaded.' onRetry={() => refetch()} />
      )}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={<Icons.notification aria-hidden='true' />}
          title="You're all caught up"
          description='New leads, booked estimates and reminders will show up here.'
        />
      )}
      {data && data.items.length > 0 && (
        <ul className='divide-border divide-y rounded-lg border'>
          {data.items.map((item) => (
            <li key={item.id}>
              <NotificationRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
