import { createContact, DuplicateContactError } from '../contacts';
import { listFieldDefs } from '../custom-fields';
import { createDeal } from '../deals';
import type { TenantContextInput } from '../tenancy';

export type WalkInInput = {
  firstName: string;
  lastName?: string;
  /** Already normalised to E.164. */
  phone: string;
  year?: string;
  make?: string;
  model?: string;
  title: string;
};

/**
 * Adds a walk-in: a real contact and a job in the first stage. It goes in as a contact, not as a
 * lead event, so nothing is dialed or texted; a person is standing at the counter.
 */
export async function createWalkIn(
  ctx: TenantContextInput,
  input: WalkInInput
): Promise<{ contactId: string } | { duplicate: true }> {
  let contactId: string;
  try {
    const contact = await createContact(ctx, {
      firstName: input.firstName,
      lastName: input.lastName || undefined,
      phones: [input.phone],
      source: 'walk_in'
    });
    contactId = contact.id;
  } catch (error) {
    if (error instanceof DuplicateContactError) return { duplicate: true };
    throw error;
  }
  const defs = new Set((await listFieldDefs(ctx, 'deal')).map((d) => d.key));
  const custom: Record<string, string | number> = {};
  if (defs.has('vehicle_year') && input.year) custom.vehicle_year = Number(input.year);
  if (defs.has('vehicle_make') && input.make) custom.vehicle_make = input.make;
  if (defs.has('vehicle_model') && input.model) custom.vehicle_model = input.model;
  await createDeal(ctx, { title: input.title, contactId, source: 'walk_in', custom });
  return { contactId };
}
