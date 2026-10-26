export { normalizePhone, normalizePhones } from './phone';
export { CONTACT_STATUSES, type ContactStatus } from './schemas';
export type { CreateContactInput, UpdateContactInput, ListContactsInput } from './schemas';
export {
  addContactTags,
  createContact,
  createManualLead,
  deleteContact,
  DuplicateContactError,
  findDuplicates,
  getContact,
  listContacts,
  NotFoundError,
  removeContactTags,
  restoreContact,
  setContactOwner,
  updateContact,
  type Contact,
  type ContactOpts,
  type CreateOpts,
  type DuplicateMatch
} from './service';
export { currentConsent, getContactDetail, type ConsentStatus, type ContactDetail } from './detail';
