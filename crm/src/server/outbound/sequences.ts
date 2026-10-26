import type { TenantContextInput } from '../tenancy';

export type EnrollInSequenceInput = { contactId: string; sequenceKey: string };

/** The sequence engine ships in M7-02. Until then enrolling is a no-op the caller can see. */
export type EnrollResult = { status: 'not_available' };

export async function enrollInSequence(
  _ctx: TenantContextInput,
  _input: EnrollInSequenceInput
): Promise<EnrollResult> {
  return { status: 'not_available' };
}
