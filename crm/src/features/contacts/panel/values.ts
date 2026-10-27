import type { ContactStatus } from '@/server/contacts/constants';

// Form values for the create and edit panel (M1-04, PRD F-07). Phones and emails are typed one per
// line; the first line is the primary. The server normalises and validates them (E.164, lower-case).

export type PanelValues = {
  firstName: string;
  lastName: string;
  phones: string;
  emails: string;
  status: ContactStatus;
  source: string;
  ownerId: string;
  tags: string[];
};

export const emptyPanelValues: PanelValues = {
  firstName: '',
  lastName: '',
  phones: '',
  emails: '',
  status: 'new',
  source: '',
  ownerId: '',
  tags: []
};

/** One entry per line or comma, blanks dropped. */
export function splitLines(text: string): string[] {
  return text
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type EditableContact = {
  firstName: string;
  lastName: string | null;
  phones: string[];
  emails: string[];
  status: string;
  source: string | null;
  ownerId: string | null;
  tags: string[];
};

export function valuesFromContact(c: EditableContact): PanelValues {
  return {
    firstName: c.firstName,
    lastName: c.lastName ?? '',
    phones: c.phones.join('\n'),
    emails: c.emails.join('\n'),
    status: c.status as ContactStatus,
    source: c.source ?? '',
    ownerId: c.ownerId ?? '',
    tags: c.tags
  };
}

/** The payload the contacts service takes. Empty text becomes null, never an empty string. */
export function toContactInput(v: PanelValues) {
  return {
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim() || null,
    phones: splitLines(v.phones),
    emails: splitLines(v.emails),
    status: v.status,
    source: v.source.trim() || null,
    ownerId: v.ownerId || null,
    tags: v.tags
  };
}
