// Client self-serve lead import (P1-5): the columns a client can map, a guess from the file's
// headers, and plain-language text for the server's reasons. Client-safe: no server imports.

export const MAPPING_FIELDS = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'externalId', label: 'ID in your old system (optional)' }
] as const;

export const CONSENT_FIELDS = [
  { key: 'consentDate', label: 'Consent date (written YYYY-MM-DD)' },
  { key: 'consentChannel', label: 'Consent channel (phone_call, sms or email)' },
  { key: 'consentEvidence', label: 'Consent proof (where the agreement came from)' }
] as const;

export type MappingKey =
  | (typeof MAPPING_FIELDS)[number]['key']
  | (typeof CONSENT_FIELDS)[number]['key'];
export type Mapping = Partial<Record<MappingKey, string>>;

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

const GUESSES: Record<MappingKey, string[]> = {
  firstName: ['firstname', 'first', 'givenname', 'fname'],
  lastName: ['lastname', 'last', 'surname', 'familyname', 'lname'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilephone', 'cell', 'cellphone', 'telephone', 'tel'],
  email: ['email', 'emailaddress', 'mail'],
  externalId: ['id', 'externalid', 'leadid', 'customerid'],
  consentDate: ['consentdate'],
  consentChannel: ['consentchannel'],
  consentEvidence: ['consentevidence', 'consentproof', 'consentsource']
};

/** Pairs each field with the first header that looks like it. Nothing is guessed twice. */
export function guessMapping(headers: readonly string[]): Mapping {
  const out: Mapping = {};
  const used = new Set<string>();
  for (const key of Object.keys(GUESSES) as MappingKey[]) {
    const hit = headers.find((h) => !used.has(h) && GUESSES[key].includes(norm(h)));
    if (hit) {
      out[key] = hit;
      used.add(hit);
    }
  }
  return out;
}

/** A dry run needs a way to reach the contact: a phone or an email column. */
export const canDryRun = (m: Mapping) => Boolean(m.phone || m.email);

/** Only the fields that were mapped, in the shape the API takes. */
export function mappingPayload(m: Mapping): Record<string, string> {
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v)) as Record<string, string>;
}

const FILE_REASONS: Record<string, string> = {
  too_large: 'That file is over the 10 MB limit.',
  unsupported_type:
    'Upload a CSV or .xlsx file. Macro-enabled and legacy Excel files are not accepted.',
  invalid_csv: 'That file is empty or is not a CSV.',
  invalid_csv_encoding: 'Save the CSV as UTF-8 and try again.',
  invalid_csv_or_row_limit: 'That CSV could not be read, or it has more than 50,000 rows.',
  invalid_xlsx: 'That Excel file could not be read.'
};

/** One sentence for an API error body. Falls back to the server's own message. */
export function importErrorMessage(body: {
  error?: { message?: string; fieldErrors?: Record<string, string[]> };
}): string {
  const reason = Object.values(body.error?.fieldErrors ?? {})
    .flat()
    .find((r) => FILE_REASONS[r]);
  if (reason) return FILE_REASONS[reason];
  if (body.error?.fieldErrors?.file)
    return 'That file could not be read. Use a plain CSV or .xlsx file without macros or a password.';
  return body.error?.message || 'The import request failed.';
}

/** Dry-run issue reasons come from the contact schema as `path: message`; show them as written. */
export const issueText = (reason: string) => reason.replace(/^(\w+): /, '$1 — ');
