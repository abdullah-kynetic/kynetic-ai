import Link from 'next/link';
import {
  IconCalendarEvent,
  IconCheckbox,
  IconFileImport,
  IconMail,
  IconMessage,
  IconNote,
  IconPhone,
  IconRobot,
  IconSettings,
  IconTransfer,
  type Icon
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/utils';
import type { ActivityType, TimelinePage } from '@/server/activity';
import { TimelineTime } from './timeline-time';
import {
  absoluteTime,
  actorLabel,
  dayKey,
  dayLabel,
  FILTER_TYPES,
  relativeTime,
  TYPE_LABEL
} from './format';

const ICON: Record<ActivityType, Icon> = {
  call: IconPhone,
  sms: IconMessage,
  email: IconMail,
  stage_change: IconTransfer,
  note: IconNote,
  task: IconCheckbox,
  appointment: IconCalendarEvent,
  automation: IconRobot,
  system: IconSettings,
  import: IconFileImport
};

/**
 * Vertical activity timeline for a contact or a deal (PRD F-19). Server-rendered: the filter chips
 * and "Older activity" are plain links that set `type` and `cursor` on `basePath`, so the page
 * stays shareable and works without client JavaScript.
 */
export function Timeline({
  page,
  basePath,
  activeTypes,
  now
}: {
  page: TimelinePage;
  /** Path the chips and the paging link point at, e.g. `/dashboard/contacts/<id>`. */
  basePath: string;
  activeTypes: ActivityType[];
  /** Passed in so the component stays pure; pages pass `new Date()`. */
  now: Date;
}) {
  const href = (types: ActivityType[], cursor?: string) => {
    const q = new URLSearchParams();
    types.forEach((t) => q.append('type', t));
    if (cursor) q.set('cursor', cursor);
    const s = q.toString();
    return `${basePath}${s ? `?${s}` : ''}#timeline`;
  };
  const toggled = (t: ActivityType) =>
    activeTypes.includes(t) ? activeTypes.filter((x) => x !== t) : [...activeTypes, t];

  const days: { key: string; label: string; items: TimelinePage['items'] }[] = [];
  for (const item of page.items) {
    const key = dayKey(item.occurredAt);
    const last = days.at(-1);
    if (last?.key === key) last.items.push(item);
    else days.push({ key, label: dayLabel(item.occurredAt), items: [item] });
  }

  return (
    <div className='flex flex-col gap-4'>
      <nav aria-label='Filter timeline by type' className='flex flex-wrap gap-1.5'>
        <Chip href={href([])} active={activeTypes.length === 0}>
          All
        </Chip>
        {FILTER_TYPES.map((t) => (
          <Chip key={t} href={href(toggled(t))} active={activeTypes.includes(t)}>
            {TYPE_LABEL[t]}
          </Chip>
        ))}
      </nav>

      {days.length === 0 ? (
        <EmptyState
          title={activeTypes.length ? 'Nothing of that type' : 'No activity yet'}
          description={
            activeTypes.length
              ? 'Clear the filter to see everything.'
              : 'Calls, texts, emails, stage changes and notes will show here.'
          }
        />
      ) : (
        <div className='flex flex-col gap-5'>
          {days.map((day) => (
            <section key={day.key} aria-label={day.label}>
              <h3 className='text-muted-foreground mb-2 text-xs font-medium'>{day.label}</h3>
              <ol className='border-border ml-3 flex flex-col gap-4 border-l'>
                {day.items.map((item) => {
                  const Glyph = ICON[item.type];
                  const machine = item.actor.type === 'alex' || item.actor.type === 'automation';
                  return (
                    <li key={item.id} className='relative pl-6'>
                      <span
                        aria-hidden
                        className='bg-card border-border absolute top-0 -left-3 flex size-6 items-center justify-center rounded-full border'
                      >
                        <Glyph className='text-muted-foreground size-3.5' />
                      </span>
                      <p className='text-sm'>
                        <span className='sr-only'>{TYPE_LABEL[item.type]}: </span>
                        {item.summary}
                      </p>
                      <div className='mt-1 flex flex-wrap items-center gap-2'>
                        <Badge variant={machine ? 'info' : 'neutral'}>
                          {actorLabel(item.actor)}
                        </Badge>
                        <TimelineTime
                          iso={item.occurredAt}
                          relative={relativeTime(item.occurredAt, now)}
                          absolute={absoluteTime(item.occurredAt)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {page.nextCursor && (
        <Link
          href={href(activeTypes, page.nextCursor)}
          className='text-primary-text self-start text-sm underline-offset-4 hover:underline'
        >
          Older activity
        </Link>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  children
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'focus-visible:ring-ring inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input text-foreground hover:bg-muted'
      )}
    >
      {children}
    </Link>
  );
}
