import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { automationRuns, automations, automationSteps, contacts, deals } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import { loadJobCards } from './jobs';
import type { CloseRate, FollowUpRun, QuoteRow } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
export const CLOSE_RATE_WINDOW_DAYS = 90;

/**
 * Quotes: deals in the Quoted stage, and the close rate. The rate is won divided by
 * (won + lost + still quoted) for deals touched in the last 90 days, shown with that definition.
 */
export async function getQuotes(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<{ quotes: QuoteRow[]; closeRate: CloseRate }> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const { stages, cards } = await loadJobCards(tx, now);
    const since = now.getTime() - CLOSE_RATE_WINDOW_DAYS * DAY_MS;
    const recent = cards.filter((c) => new Date(c.updatedAt).getTime() >= since);
    const quotes = cards
      .filter((c) => c.stageName === 'Quoted')
      .map((c) => ({
        ...c,
        ageDays: Math.max(0, Math.floor((now.getTime() - new Date(c.updatedAt).getTime()) / DAY_MS))
      }));
    const isWon = (id: string) => stages.find((s) => s.id === id)?.isWon === true;
    const isLost = (id: string) => stages.find((s) => s.id === id)?.isLost === true;
    const won = recent.filter((c) => isWon(c.stageId)).length;
    const lost = recent.filter((c) => isLost(c.stageId)).length;
    const stillQuoted = recent.filter((c) => c.stageName === 'Quoted').length;
    const total = won + lost + stillQuoted;
    return {
      quotes,
      closeRate: {
        won,
        lost,
        stillQuoted,
        rate: total > 0 ? won / total : null,
        windowDays: CLOSE_RATE_WINDOW_DAYS
      }
    };
  });
}

/** Quote follow-up runs, each with its steps marked sent, next or pending. */
export async function getFollowUps(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<{ runs: FollowUpRun[] }> {
  return shopRun(ctx, opts, async (tx) => {
    const rows = await tx
      .select({
        id: automationRuns.id,
        automationId: automationRuns.automationId,
        contactId: automationRuns.contactId,
        dealId: automationRuns.dealId,
        status: automationRuns.status,
        stopReason: automationRuns.stopReason,
        currentStep: automationRuns.currentStep,
        nextRunAt: automationRuns.nextRunAt,
        startedAt: automationRuns.createdAt,
        first: contacts.firstName,
        last: contacts.lastName,
        dealTitle: deals.title
      })
      .from(automationRuns)
      .innerJoin(automations, eq(automations.id, automationRuns.automationId))
      .innerJoin(contacts, eq(contacts.id, automationRuns.contactId))
      .leftJoin(deals, eq(deals.id, automationRuns.dealId))
      .where(and(eq(automations.kind, 'template'), eq(automations.templateKey, 'quote_followup')))
      .orderBy(sql`${automationRuns.createdAt} desc`)
      .limit(200);
    const automationIds = [...new Set(rows.map((r) => r.automationId))];
    const steps = automationIds.length
      ? await tx
          .select()
          .from(automationSteps)
          .where(inArray(automationSteps.automationId, automationIds))
          .orderBy(asc(automationSteps.position))
      : [];
    return {
      runs: rows.map((r) => {
        const mine = steps.filter((s) => s.automationId === r.automationId);
        const active = r.status === 'active';
        return {
          id: r.id,
          contactId: r.contactId,
          customerName: `${r.first} ${r.last ?? ''}`.trim() || null,
          dealId: r.dealId,
          dealTitle: r.dealTitle,
          status: r.status,
          stopReason: r.stopReason,
          currentStep: r.currentStep,
          nextRunAt: r.nextRunAt,
          startedAt: r.startedAt,
          replied: r.status === 'stopped_reply',
          steps: mine.map((s) => ({
            position: s.position,
            channel: s.channel,
            delayMinutes: s.delayMinutes,
            state:
              s.position < r.currentStep
                ? ('sent' as const)
                : active && s.position === r.currentStep
                  ? ('next' as const)
                  : ('pending' as const)
          }))
        };
      })
    };
  });
}
