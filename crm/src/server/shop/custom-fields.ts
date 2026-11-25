import { createFieldDef, listFieldDefs, type CustomFieldOpts } from '../custom-fields';
import type { CreateFieldDefInput } from '../custom-fields/schemas';
import type { TenantContextInput } from '../tenancy';

/**
 * Deal fields a repair shop tracks on a job. Keys are fixed so the shop screens can read them.
 * They are created once per tenant by `ensureAutoBodyFields`; nothing runs this on its own.
 */
type FieldSpec = Omit<CreateFieldDefInput, 'entity' | 'options'> & {
  key: string;
  options?: readonly string[];
};

export const AUTO_BODY_FIELDS = [
  { key: 'vehicle_year', label: 'Vehicle year', type: 'number', showInTable: true },
  { key: 'vehicle_make', label: 'Vehicle make', type: 'text', showInTable: true },
  { key: 'vehicle_model', label: 'Vehicle model', type: 'text', showInTable: true },
  {
    key: 'payment_type',
    label: 'Payment type',
    type: 'select',
    options: ['Out-of-pocket', 'Insurance'],
    showInTable: true,
    filterable: true
  },
  { key: 'insurer', label: 'Insurer', type: 'text', filterable: true },
  { key: 'claim_number', label: 'Claim number', type: 'text' },
  { key: 'estimate_amount', label: 'Estimate amount', type: 'money', showInTable: true },
  { key: 'drop_off_date', label: 'Drop-off date', type: 'date', showInTable: true },
  { key: 'tech', label: 'Tech', type: 'text', filterable: true }
] as const satisfies readonly FieldSpec[];

export type AutoBodyFieldKey = (typeof AUTO_BODY_FIELDS)[number]['key'];
const SPECS: readonly FieldSpec[] = AUTO_BODY_FIELDS;

/**
 * Creates any missing auto body deal fields for the tenant in `ctx` (owner or admin). A field that
 * already exists, even one renamed or edited by the client, is left exactly as it is. Safe to run twice.
 */
export async function ensureAutoBodyFields(
  ctx: TenantContextInput,
  opts: CustomFieldOpts = {}
): Promise<{ created: AutoBodyFieldKey[]; existing: AutoBodyFieldKey[] }> {
  const have = new Set((await listFieldDefs(ctx, 'deal', opts)).map((def) => def.key));
  const created: AutoBodyFieldKey[] = [];
  const existing: AutoBodyFieldKey[] = [];
  for (const field of SPECS) {
    if (have.has(field.key)) {
      existing.push(field.key as AutoBodyFieldKey);
      continue;
    }
    await createFieldDef(
      ctx,
      { entity: 'deal', ...field, options: [...(field.options ?? [])] },
      opts
    );
    created.push(field.key as AutoBodyFieldKey);
  }
  return { created, existing };
}
