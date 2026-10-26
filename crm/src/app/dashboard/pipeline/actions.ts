'use server';

import { headers } from 'next/headers';
import { dealsScope, moveDeal } from '@/server/deals';
import { AppError, toErrorResult } from '@/server/errors';

export type MoveResult = { ok: true } | { ok: false; code: string; message: string };

/**
 * Persists a kanban move (F-16). The caller's tenant and write access come from the session, never
 * from the client; moving into a Lost stage needs a reason (F-14). `deal.stage_changed` is emitted
 * by the service in the same transaction.
 */
export async function moveDealAction(
  dealId: string,
  input: { stageId: string; afterDealId?: string | null; lostReason?: string }
): Promise<MoveResult> {
  try {
    const ctx = await dealsScope(await headers(), 'write');
    if (!ctx) throw new AppError('FORBIDDEN');
    await moveDeal(ctx, dealId, input);
    return { ok: true };
  } catch (err) {
    const { body } = toErrorResult(err);
    return { ok: false, code: body.error.code, message: body.error.message };
  }
}
