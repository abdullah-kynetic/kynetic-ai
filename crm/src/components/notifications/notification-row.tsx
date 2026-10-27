'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { formatRelative, useMarkRead, type NotificationItem } from './use-notifications';

/**
 * One notification. Opening it marks it read and goes to the linked record (F-35). Unread rows are
 * emphasised with weight and a dot, never by colour alone.
 */
export function NotificationRow({ item, onOpen }: { item: NotificationItem; onOpen?: () => void }) {
  const router = useRouter();
  const markRead = useMarkRead();
  const unread = item.readAt === null;

  function open() {
    if (unread) markRead.mutate(item.id);
    onOpen?.();
    if (item.link) router.push(item.link);
  }

  return (
    <button
      type='button'
      onClick={open}
      className={cn(
        'hover:bg-muted focus-visible:ring-ring flex w-full items-start gap-3 rounded-md px-3 py-2 text-start focus-visible:ring-2 focus-visible:outline-none'
      )}
    >
      <span
        aria-hidden='true'
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          unread ? 'bg-primary' : 'bg-transparent'
        )}
      />
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <span className={cn('text-sm', unread ? 'font-semibold' : 'font-normal')}>
          {unread && <span className='sr-only'>Unread: </span>}
          {item.title}
        </span>
        {item.body && (
          <span className='text-muted-foreground line-clamp-2 text-xs'>{item.body}</span>
        )}
        <time dateTime={item.createdAt} className='text-muted-foreground text-xs'>
          {formatRelative(item.createdAt)}
        </time>
      </span>
    </button>
  );
}
