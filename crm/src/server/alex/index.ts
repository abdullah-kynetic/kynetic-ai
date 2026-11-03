import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Tx } from '../db/client';
import { alexConfigs } from '../db/schema';

/**
 * Everything the runtime needs from `alex_configs` (call start, OutboundGate, admin editor). The raw
 * prompt lives in `alex_prompts` (admin-only RLS) and is never part of this service's output.
 */
export type AlexConfig = typeof alexConfigs.$inferSelect;

/**
 * What an owner may see (F-42, DC rule: raw prompt never shown). An explicit allow-list: a column
 * added to `alex_configs` later stays hidden from owners until it is listed here. Provider, agent
 * reference, voice id, prompt version and retry cadence are Kynetic's to manage.
 */
export type AlexSettingsView = {
  greeting: string | null;
  questions: unknown[];
  bookingRules: Record<string, unknown>;
  callWindows: Record<string, unknown>;
  transferNumber: string | null;
  paused: boolean;
  updatedAt: string;
};

export function toSettingsView(row: AlexConfig): AlexSettingsView {
  return {
    greeting: row.greeting,
    questions: Array.isArray(row.questions) ? row.questions : [],
    bookingRules: asRecord(row.bookingRules),
    callWindows: asRecord(row.callWindows),
    transferNumber: row.transferNumberE164,
    paused: row.paused,
    updatedAt: row.updatedAt
  };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** The full config row for the tenant in the transaction context, or null when none exists yet. */
export async function getAlexConfig(tx: Tx): Promise<AlexConfig | null> {
  const [row] = await tx.select().from(alexConfigs).limit(1);
  return row ?? null;
}

/** The owner-facing projection (read-only view). Null when the tenant has no config. */
export async function getAlexSettingsView(tx: Tx): Promise<AlexSettingsView | null> {
  const row = await getAlexConfig(tx);
  return row ? toSettingsView(row) : null;
}

/** True when Alex is paused. A tenant with no config is treated as paused: no config, no calls. */
export async function isAlexPaused(tx: Tx): Promise<boolean> {
  const row = await getAlexConfig(tx);
  return row ? row.paused : true;
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 09:00.');

/**
 * The only fields an owner may write (F-42, PRD decision 8): pause and call hours. `.strict()` makes
 * any other key a validation error, so a crafted request cannot reach greeting, questions, provider
 * or anything else; the update below also names its columns explicitly.
 */
export const clientAlexUpdateSchema = z
  .object({
    paused: z.boolean().optional(),
    callWindows: z
      .object({ start: hhmm, end: hhmm })
      .strict()
      .refine((w) => w.start < w.end, { message: 'Start must be before end.' })
      .optional()
  })
  .strict()
  .refine((v) => v.paused !== undefined || v.callWindows !== undefined, {
    message: 'Nothing to change.'
  });

export type ClientAlexUpdate = z.input<typeof clientAlexUpdateSchema>;

export class AlexConfigMissingError extends Error {
  readonly code = 'ALEX_NOT_CONFIGURED';
  constructor() {
    super('Alex is not set up for this account yet.');
    this.name = 'AlexConfigMissingError';
  }
}

/**
 * Client-side write: pause and call hours only. Other keys already in `call_windows` are kept. The
 * audit row (before/after limited to the two fields) commits with the update. Quiet-hours and state
 * rules still apply at call time whatever window is saved (OutboundGate).
 */
export async function updateClientAlexSettings(
  tx: Tx,
  input: ClientAlexUpdate,
  userId: string
): Promise<AlexSettingsView> {
  const patch = clientAlexUpdateSchema.parse(input);
  const before = await getAlexConfig(tx);
  if (!before) throw new AlexConfigMissingError();

  const nextWindows = patch.callWindows
    ? { ...asRecord(before.callWindows), ...patch.callWindows }
    : before.callWindows;
  const [row] = await tx
    .update(alexConfigs)
    .set({
      paused: patch.paused ?? before.paused,
      callWindows: nextWindows,
      updatedBy: userId,
      updatedAt: new Date().toISOString()
    })
    .where(eq(alexConfigs.tenantId, before.tenantId))
    .returning();

  await audit(tx, {
    action: 'alex.settings.client_update',
    entity: 'alex_configs',
    entityId: before.tenantId,
    before: { paused: before.paused, callWindows: before.callWindows },
    after: { paused: row!.paused, callWindows: row!.callWindows }
  });
  return toSettingsView(row!);
}
