// Plain values with no server imports, so client components can use them (public entry point next
// to `@/server/contacts`).

export const CONTACT_STATUSES = ['new', 'working', 'booked', 'won', 'lost', 'dead'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_SORT_FIELDS = ['name', 'status', 'source', 'createdAt', 'updatedAt'] as const;
export type ContactSortField = (typeof CONTACT_SORT_FIELDS)[number];

export const CONTACT_PAGE_SIZES = [10, 20, 30, 50, 100] as const;
export const CONTACT_DEFAULT_PAGE_SIZE = 20;

/** `none` in an owner filter means "no owner". */
export const NO_OWNER = 'none';
