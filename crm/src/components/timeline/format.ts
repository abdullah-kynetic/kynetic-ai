import type { ActivityType, TimelineItem } from '@/server/activity';

export const TYPE_LABEL: Record<ActivityType, string> = {
  call: 'Calls',
  sms: 'Texts',
  email: 'Emails',
  stage_change: 'Stage changes',
  note: 'Notes',
  task: 'Tasks',
  appointment: 'Appointments',
  automation: 'Automation',
  system: 'System',
  import: 'Imports'
};

/** Filter chips follow the PRD list; system and import entries show under "All" only. */
export const FILTER_TYPES: ActivityType[] = [
  'call',
  'sms',
  'email',
  'stage_change',
  'note',
  'task',
  'appointment',
  'automation'
];

export function actorLabel(actor: TimelineItem['actor']): string {
  switch (actor.type) {
    case 'alex':
      return 'Alex';
    case 'automation':
      return 'Automation';
    case 'system':
      return 'System';
    default:
      return actor.name ?? 'Team member';
  }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60]
];

export function relativeTime(iso: string, now: Date): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.trunc(seconds / size), unit);
  }
  return 'just now';
}

export const absoluteTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }) + ' UTC';

export const dayKey = (iso: string) => iso.slice(0, 10);

export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    dateStyle: 'full',
    timeZone: 'UTC'
  });

export const currentTime = () => new Date();
