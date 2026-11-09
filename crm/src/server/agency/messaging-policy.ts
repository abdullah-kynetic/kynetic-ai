import type { ContactDecision } from '../consent';
/** Stub sink only. Denial never invokes it, including replies to inbound messages. */
export async function deliverAgencyPreview<T>(decision: ContactDecision, sink: () => Promise<T>) {
  if (!decision.allowed) return { status: 'blocked' as const, reason: decision.reason };
  return { status: 'simulated' as const, result: await sink() };
}
