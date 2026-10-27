import type { FieldErrors } from '../errors';
import { parseMoneyToCents } from './money';

// Deal form input (M2-03; PRD F-14). The slide-out sends strings; this turns them into the service
// patch. Money is typed in dollars and stored in cents. Blank optional fields clear the value.

export type DealFormInput = {
  title: string;
  value: string;
  serviceType: string;
  expectedClose: string;
  source: string;
  ownerId: string;
  stageId: string;
  lostReason: string;
};

export type ParsedDealForm = {
  patch: {
    title: string;
    valueCents: number;
    serviceType: string | null;
    expectedClose: string | null;
    source: string | null;
    ownerId: string | null;
  };
  stageId: string;
  lostReason: string | undefined;
};

const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** `1250000` becomes `12500`; amounts with cents keep both decimals (`12500.50`). For input boxes. */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Returns the parsed form, or the field errors to show next to the inputs. */
export function parseDealForm(
  raw: DealFormInput
): { ok: true; value: ParsedDealForm } | { ok: false; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const title = raw.title.trim();
  if (!title) fieldErrors.title = ['required'];
  // A blank value is zero: a deal can exist before anyone has priced it.
  const valueCents = raw.value.trim() === '' ? 0 : parseMoneyToCents(raw.value);
  if (valueCents === null) fieldErrors.valueCents = ['invalid'];
  if (!raw.stageId) fieldErrors.stageId = ['required'];
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      patch: {
        title,
        valueCents: valueCents as number,
        serviceType: blankToNull(raw.serviceType),
        expectedClose: blankToNull(raw.expectedClose),
        source: blankToNull(raw.source),
        ownerId: blankToNull(raw.ownerId)
      },
      stageId: raw.stageId,
      lostReason: blankToNull(raw.lostReason) ?? undefined
    }
  };
}
