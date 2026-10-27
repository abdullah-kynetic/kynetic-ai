'use server';

import {
  DAYS,
  draftOwnerInvite,
  getInviteMailer,
  onboardTenant,
  sendOwnerInvite
} from '@/server/admin';
import { authorize, ForbiddenError, requireUser, resolveActor } from '@/server/auth';
import { getEnv } from '@/server/env';
import { AppError } from '@/server/errors';
import { headers } from 'next/headers';

export type OnboardState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string[]> }
  | {
      status: 'created';
      tenantId: string;
      slug: string;
      ownerEmail: string;
      draft: { subject: string; body: string };
    };

export type SendState = { status: 'idle' | 'sent' } | { status: 'error'; message: string };

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/** The signed-in admin, checked against the matrix on this request (SECURITY 2.2: never trust the page). */
async function adminCtx() {
  const user = await requireUser(await headers());
  const actor = await resolveActor(user);
  authorize(actor, 'admin.onboard');
  return { userId: user.id, role: 'admin' as const };
}

function failure(err: unknown): {
  status: 'error';
  message: string;
  fieldErrors?: Record<string, string[]>;
} {
  if (err instanceof AppError) {
    return { status: 'error', message: err.message, fieldErrors: err.fieldErrors };
  }
  if (err instanceof ForbiddenError)
    return { status: 'error', message: 'Only an admin can onboard a client.' };
  console.error('Onboarding failed', err instanceof Error ? err.name : 'unknown');
  return { status: 'error', message: 'Something went wrong. Nothing was created. Try again.' };
}

/** Submits the 30-second form (F-55). The invite email is not sent here; see `approveInvite`. */
export async function onboardClient(_prev: OnboardState, form: FormData): Promise<OnboardState> {
  try {
    const ctx = await adminCtx();
    const zips = text(form, 'serviceZips')
      .split(/[\s,]+/)
      .filter(Boolean);
    const result = await onboardTenant(ctx, {
      businessName: text(form, 'businessName'),
      slug: text(form, 'slug') || undefined,
      ownerEmail: text(form, 'ownerEmail'),
      phone: text(form, 'phone'),
      industry: text(form, 'industry'),
      timezone: text(form, 'timezone'),
      hours: {
        days: DAYS.filter((d) => form.getAll('days').includes(d)),
        open: text(form, 'open'),
        close: text(form, 'close')
      },
      serviceZips: zips,
      primaryColor: text(form, 'primaryColor') || undefined,
      logoUrl: text(form, 'logoUrl') || undefined,
      plan: text(form, 'plan'),
      tier: text(form, 'tier') || undefined,
      modules: form.getAll('modules').map(String),
      crmLevel: text(form, 'crmLevel') || undefined
    });
    return {
      status: 'created',
      ...result,
      draft: draftOwnerInvite(text(form, 'businessName'))
    };
  } catch (err) {
    return failure(err);
  }
}

/** The admin's approval: issues the invite link and emails the owner on record. */
export async function approveInvite(tenantId: string): Promise<SendState> {
  try {
    const ctx = await adminCtx();
    const mailer = getInviteMailer();
    if (!mailer) {
      return {
        status: 'error',
        message: 'Email delivery is not connected yet, so the invite was not sent.'
      };
    }
    await sendOwnerInvite(ctx, tenantId, {
      email: mailer.provider,
      fromAddress: mailer.fromAddress,
      baseUrl: getEnv().APP_BASE_URL
    });
    return { status: 'sent' };
  } catch (err) {
    const f = failure(err);
    return { status: 'error', message: f.message };
  }
}
