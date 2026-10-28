import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { alexConfigs, alexPrompts } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { getVoiceProvider } from '../calls/provider';
import type { VoiceProvider } from '../adapters/voice/types';
import { withTenant } from '../tenancy';

const inputSchema = z.strictObject({
  provider: z.enum(['elevenlabs', 'retell']).optional(),
  agentRef: z.string().trim().max(200).nullable().optional(),
  voice: z.string().trim().max(200).nullable().optional(),
  greeting: z.string().max(2000).nullable().optional(),
  questions: z.array(z.unknown()).max(100).optional(),
  bookingRules: z.record(z.string(), z.unknown()).optional(),
  callWindows: z.record(z.string(), z.unknown()).optional(),
  retry: z.record(z.string(), z.unknown()).optional(),
  transferNumberE164: z.string().regex(/^\+[1-9][0-9]{7,14}$/).nullable().optional(),
  paused: z.boolean().optional(),
  prompt: z.string().min(1).max(100000).optional()
});

export async function updateAdminAlexConfig(ctx: { tenantId: string; userId: string }, raw: unknown, opts: { db?: Db } = {}) {
  const input = inputSchema.safeParse(raw);
  if (!input.success) throw new ValidationError({ config: ['invalid'] });
  return withTenant({ ...ctx, role: 'admin' }, async (tx) => {
    const [before] = await tx.select().from(alexConfigs).limit(1);
    if (!before) throw new AppError('NOT_FOUND');
    const { prompt, ...patch } = input.data;
    const [after] = await tx.update(alexConfigs).set({ ...patch, updatedBy: ctx.userId, updatedAt: new Date().toISOString() }).where(eq(alexConfigs.tenantId, ctx.tenantId)).returning();
    if (prompt !== undefined) {
      const version = before.promptVersion + 1;
      await tx.update(alexPrompts).set({ isActive: false }).where(eq(alexPrompts.tenantId, ctx.tenantId));
      await tx.insert(alexPrompts).values({ tenantId: ctx.tenantId, version, body: prompt, isActive: true, createdBy: ctx.userId });
      await tx.update(alexConfigs).set({ promptVersion: version }).where(eq(alexConfigs.tenantId, ctx.tenantId));
    }
    await audit(tx, { action: 'alex.settings.admin_update', entity: 'alex_configs', entityId: ctx.tenantId,
      before: { provider: before.provider, agentRef: before.agentRef, promptVersion: before.promptVersion, paused: before.paused },
      after: { provider: after!.provider, agentRef: after!.agentRef, promptVersion: prompt === undefined ? after!.promptVersion : before.promptVersion + 1, paused: after!.paused } });
    return after!;
  }, opts);
}

export async function placeAdminTestCall(ctx: { tenantId: string; userId: string }, toE164: string, opts: { db?: Db; provider?: VoiceProvider } = {}) {
  const parsed = z.string().regex(/^\+[1-9][0-9]{7,14}$/).safeParse(toE164);
  if (!parsed.success) throw new ValidationError({ phone: ['invalid'] });
  return withTenant({ ...ctx, role: 'admin' }, async (tx) => {
    const [config] = await tx.select().from(alexConfigs).limit(1);
    if (!config?.agentRef) throw new AppError('NOT_FOUND');
    const provider = opts.provider ?? getVoiceProvider(config.provider as 'elevenlabs' | 'retell');
    if (!provider?.placeTestCall) throw new AppError('PROVIDER_ERROR');
    const result = await provider.placeTestCall({ agentId: config.agentRef, toE164: parsed.data });
    await audit(tx, { action: 'alex.test_call', entity: 'alex_configs', entityId: ctx.tenantId, after: { provider: config.provider } });
    return result;
  }, opts);
}
