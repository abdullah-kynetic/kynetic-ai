import { desc, eq, inArray } from 'drizzle-orm';
import { alexConfigs, calls, contacts, messages } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import { loadJobCards } from './jobs';
import type { JobCard } from './types';

export type CallRow = {
  id: string;
  contactId: string | null;
  name: string;
  direction: 'inbound' | 'outbound';
  startedAt: string;
  durationS: number | null;
  outcome: string | null;
  summary: string | null;
};
export type TextRow = {
  id: string;
  contactId: string | null;
  name: string;
  direction: 'inbound' | 'outbound';
  at: string;
  body: string;
  status: string;
};
/** What the receptionist is set to do, read from the client's settings. Read-only here. */
export type ReceptionistRules = {
  configured: boolean;
  paused: boolean;
  greeting: string | null;
  questions: string[];
  bookingSummary: string | null;
  callWindow: string | null;
};
export type CallsView = {
  calls: CallRow[];
  texts: TextRow[];
  rules: ReceptionistRules;
  jobs: { id: string; label: string }[];
};

const nameOf = (first: string | null, last: string | null) =>
  `${first ?? ''} ${last ?? ''}`.trim() || 'Unknown caller';

const jobLabel = (j: JobCard) =>
  [j.vehicleLabel || j.title, j.customerName].filter(Boolean).join(' · ');

export async function getShopCalls(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<CallsView> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const callRows = await tx.select().from(calls).orderBy(desc(calls.startedAt)).limit(50);
    const textRows = await tx.select().from(messages).orderBy(desc(messages.createdAt)).limit(50);
    const ids = [
      ...new Set([...callRows, ...textRows].map((r) => r.contactId).filter((x): x is string => !!x))
    ];
    const people = ids.length
      ? await tx
          .select({
            id: contacts.id,
            first: contacts.firstName,
            last: contacts.lastName
          })
          .from(contacts)
          .where(inArray(contacts.id, ids))
      : [];
    const names = new Map(people.map((p) => [p.id, nameOf(p.first, p.last)]));
    const [alex] = await tx.select().from(alexConfigs).limit(1);
    const questions = Array.isArray(alex?.questions)
      ? (alex!.questions as unknown[]).filter((q): q is string => typeof q === 'string')
      : [];
    const booking = (alex?.bookingRules ?? {}) as { summary?: unknown };
    const windows = (alex?.callWindows ?? {}) as {
      start?: unknown;
      end?: unknown;
    };
    const { stages, cards } = await loadJobCards(tx, now);
    const openJobs = cards.filter((c) => {
      const s = stages.find((x) => x.id === c.stageId);
      return s && !s.isWon && !s.isLost;
    });
    return {
      calls: callRows.map((c) => ({
        id: c.id,
        contactId: c.contactId,
        name: c.contactId ? (names.get(c.contactId) ?? 'Unknown caller') : 'Unknown caller',
        direction: c.direction as 'inbound' | 'outbound',
        startedAt: c.startedAt,
        durationS: c.durationS,
        outcome: c.outcome,
        summary: c.summary
      })),
      texts: textRows.map((m) => ({
        id: m.id,
        contactId: m.contactId,
        name: m.contactId ? (names.get(m.contactId) ?? 'Unknown') : 'Unknown',
        direction: m.direction as 'inbound' | 'outbound',
        at: m.createdAt,
        body: m.body,
        status: m.status
      })),
      rules: {
        configured: !!alex,
        paused: alex?.paused ?? false,
        greeting: alex?.greeting ?? null,
        questions,
        bookingSummary: typeof booking.summary === 'string' ? booking.summary : null,
        callWindow:
          typeof windows.start === 'string' && typeof windows.end === 'string'
            ? `${windows.start} to ${windows.end}`
            : null
      },
      jobs: openJobs.map((j) => ({ id: j.id, label: jobLabel(j) }))
    };
  });
}

const STAGE_WORDS: Record<string, string> = {
  'New lead': 'we have your request and are getting your estimate ready',
  Quoted: 'your estimate is ready and waiting for your go-ahead',
  'Waiting on insurance': 'we are waiting on your insurance company to approve the repair',
  'Parts ordered': 'the parts are ordered and we are waiting on delivery',
  'In repair and paint': 'it is in the shop being repaired and painted',
  'Ready for pickup': 'it is finished and ready for you to pick up',
  'Picked up': 'it has been picked up'
};

/** The reply the receptionist would give to "Where is my car?" for one job. Preview only; nothing is sent. */
export async function whereIsMyCar(
  ctx: TenantContextInput,
  jobId: string,
  opts: ShopOpts = {}
): Promise<{ reply: string; stage: string } | null> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const { cards } = await loadJobCards(tx, now);
    const job = cards.find((c) => c.id === jobId);
    if (!job) return null;
    const who = job.customerName ? job.customerName.split(' ')[0] : 'there';
    const car = job.vehicleLabel || 'your car';
    const words = STAGE_WORDS[job.stageName] ?? `it is at the "${job.stageName}" step`;
    return {
      stage: job.stageName,
      reply: `Hi ${who}, this is the shop. Your ${car}: ${words}.${job.tech ? ` ${job.tech} has it.` : ''}`
    };
  });
}
