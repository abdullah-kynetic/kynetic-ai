import { can, type Actor } from '../auth/permissions';

/**
 * Who may run the contact import for a tenant: Kynetic admins (`import.onboarding`, every record
 * type) and the client's own owner (`import.self`, contacts only). `can` already ties both to the
 * tenant in the context: an owner's membership is for one tenant, so asking about another denies.
 */
export function canImportContacts(actor: Actor, tenantId: string): boolean {
  return can(actor, 'import.onboarding', tenantId) || can(actor, 'import.self', tenantId);
}

/** Only Kynetic admins import companies, deals and notes, or touch batches of those kinds. */
export function canImportAnyEntity(actor: Actor, tenantId: string): boolean {
  return can(actor, 'import.onboarding', tenantId);
}
