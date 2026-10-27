import type { ContactStatus } from '@/server/contacts/constants';
import type { StatusTone } from '@/components/ui/badge';

export const STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'New',
  working: 'Working',
  booked: 'Booked',
  won: 'Won',
  lost: 'Lost',
  dead: 'Dead'
};

/** DESIGN_SYSTEM "Chips and badges": green = booked or won, lost and dead are neutral. */
export const STATUS_TONES: Record<ContactStatus, StatusTone> = {
  new: 'info',
  working: 'info',
  booked: 'success',
  won: 'success',
  lost: 'neutral',
  dead: 'neutral'
};

const SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  angi: 'Angi',
  google_lsa: 'Google LSA',
  website: 'Website',
  manual: 'Manual',
  import: 'Import'
};

export function sourceLabel(source: string | null): string {
  if (!source) return '';
  return SOURCE_LABELS[source] ?? source.replaceAll('_', ' ');
}

/** Stored E.164, shown in national format for US and Canada numbers (DESIGN_SYSTEM forms). */
export function formatPhone(e164: string | null): string {
  if (!e164) return '';
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function fullName(row: { firstName: string; lastName: string | null }): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || 'Unnamed contact';
}

/** A date in the tenant's timezone, so the same row reads the same on the server and in the browser. */
export function formatDay(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(iso));
  } catch {
    return '';
  }
}
