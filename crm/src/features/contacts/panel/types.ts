export { CONTACT_STATUSES } from '@/server/contacts/constants';

/** What the duplicate warning needs from a match (the service's `DuplicateMatch`). */
export type DuplicateMatchView = {
  id: string;
  firstName: string;
  lastName: string | null;
  matchedPhones: string[];
  matchedEmails: string[];
};
