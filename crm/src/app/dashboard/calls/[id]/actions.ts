'use server';

import { createStorage } from '@/server/adapters/storage';
import { flagCall, getCallRecordingUrl } from '@/server/calls';
import { getEnv } from '@/server/env';
import { toErrorResult } from '@/server/errors';
import { describeLlmFailure } from '@/server/llm/messages';
import { summarizeCall } from '@/server/llm/features/call-summary';
import { revalidatePath } from 'next/cache';
import { callerForRequest } from './session';

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

/** A fresh five-minute signed URL for the player. The object key never leaves the server. */
export async function recordingUrlAction(callId: string): Promise<Result<{ url: string }>> {
  try {
    const caller = await callerForRequest();
    if (!caller) return { ok: false, message: 'Not signed in' };
    const { url } = await getCallRecordingUrl(
      caller.actor,
      caller.ctx,
      callId,
      createStorage(getEnv())
    );
    return { ok: true, url };
  } catch (e) {
    return { ok: false, message: toErrorResult(e).body.error.message };
  }
}

export async function flagCallAction(
  callId: string,
  reason: string
): Promise<Result<{ alreadyFlagged: boolean }>> {
  try {
    const caller = await callerForRequest();
    if (!caller) return { ok: false, message: 'Not signed in' };
    const r = await flagCall(caller.actor, caller.ctx, callId, { reason });
    return { ok: true, alreadyFlagged: r.alreadyFlagged };
  } catch (e) {
    return { ok: false, message: toErrorResult(e).body.error.message };
  }
}

export async function summarizeCallAction(callId: string): Promise<Result<object>> {
  try {
    const caller = await callerForRequest();
    if (!caller) return { ok: false, message: 'Not signed in' };
    await summarizeCall(caller.actor, caller.ctx, callId);
    revalidatePath(`/dashboard/calls/${callId}`);
    return { ok: true };
  } catch (e) {
    const known = describeLlmFailure(e);
    return { ok: false, message: known ?? toErrorResult(e).body.error.message };
  }
}
