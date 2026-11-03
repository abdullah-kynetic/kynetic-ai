/**
 * The Terms of Service and Privacy Policy users must accept (F-102).
 *
 * PLACEHOLDER COPY. The final wording needs counsel (PRD F-102, UNRESOLVED). Bump the `version` of a
 * document whenever its text changes: every user is then asked to accept again, and the old
 * acceptance rows stay as the record. Versions are plain strings stored in `terms_acceptances.version`.
 */
export const TERMS_DOCUMENTS = ['terms', 'privacy'] as const;
export type TermsDocument = (typeof TERMS_DOCUMENTS)[number];

export type LegalDocument = {
  document: TermsDocument;
  version: string;
  title: string;
  paragraphs: readonly string[];
};

export const CURRENT_DOCUMENTS: readonly LegalDocument[] = [
  {
    document: 'terms',
    version: '2026-10-26-draft',
    title: 'Terms of Service',
    paragraphs: [
      'Draft wording. This text is a placeholder until counsel has reviewed the final Terms of Service.',
      'By using the Kynetic portal you agree to use it only for your own business, to keep your sign-in private, and to follow the law when you contact your own customers.',
      'Kynetic AI provides the portal and its automations as described in your agreement with us.'
    ]
  },
  {
    document: 'privacy',
    version: '2026-10-26-draft',
    title: 'Privacy Policy',
    paragraphs: [
      'Draft wording. This text is a placeholder until counsel has reviewed the final Privacy Policy.',
      'We store the business and contact information you and your customers give us, and the records of calls and messages our automations make for you, so we can run the service.',
      'Your data is kept apart from every other client. We do not sell it.'
    ]
  }
];
