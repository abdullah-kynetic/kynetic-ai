import { createHash } from 'node:crypto';

// SECURITY 3.5: the disclosure text lives on `tenants.recording_disclosure`, which has no version
// column, so the version recorded on each call is a short hash of the exact text that was sent.
// Changing a word gives a new version; changing nothing keeps the old one.

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** The disclosure text, or null when the tenant has none (blank counts as none). */
export function cleanDisclosure(text: string | null | undefined): string | null {
  const t = text?.trim();
  return t ? t : null;
}

export function disclosureVersion(text: string): string {
  return `sha256:${createHash('sha256').update(norm(text)).digest('hex').slice(0, 12)}`;
}

/** Did the agent say the disclosure? Case, punctuation and spacing are ignored; the words must all be there. */
export function disclosureHeard(transcript: string, text: string): boolean {
  const needle = norm(text);
  return needle.length > 0 && norm(transcript).includes(needle);
}
