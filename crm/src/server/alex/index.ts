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
