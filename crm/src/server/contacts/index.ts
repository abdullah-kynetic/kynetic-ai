export { contactsScope, contactsActorScope } from './scope';
export {
  BULK_MAX_CONTACTS,
  bulkActionSchema,
  bulkCapabilities,
  bulkContactsSchema,
  bulkUpdateContacts,
  type BulkAction,
  type BulkCapabilities,
  type BulkContactsInput,
  type BulkContactsResult
} from './bulk';
export { normalizePhone, normalizePhones } from './phone';
export { CONTACT_STATUSES, type ContactStatus } from './schemas';
export {
  CONTACT_DEFAULT_PAGE_SIZE,
  CONTACT_PAGE_SIZES,
  CONTACT_SORT_FIELDS,
  NO_OWNER,
  type ContactSortField
} from './constants';
export {
  contactFacets,
  searchContacts,
  searchContactsSchema,
  type ContactFacets,
  type ContactListRow,
  type ContactSearchResult,
  type SearchContactsInput
} from './search';
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
export { loadContactForPanel, saveContactFromPanel, type PanelSaveResult } from './panel';
export { currentConsent, getContactDetail, type ConsentStatus, type ContactDetail } from './detail';
