import { z } from 'zod';
import type { Actor } from '../auth/permissions';
import type { Tx } from '../db/client';
import { AppError, ValidationError } from '../errors';
import { listAutomationTemplates, setAutomationEnabled } from '../automations/service';
import { loadEnabledModules } from '../modules';
import type { ServiceContext } from '../service-auth/authenticate';
import { ownerCtx, ownerUserId } from './owner';

// Automation templates on or off for the service API (C13, part 2b). Listing needs settings:read. A
// toggle needs automation:write and goes through the portal's toggle, which checks the module, cancels
// pending runs when switched off, and writes the audit row in the same transaction.

const enabledSchema = z.strictObject({ enabled: z.boolean() });

async function ownerActor(
  tx: Tx,
  svc: ServiceContext
): Promise<{ actor: Actor; ctx: ReturnType<typeof ownerCtx> }> {
  const userId = await ownerUserId(tx, svc);
  const ctx = ownerCtx(svc, userId);
  return {
    ctx,
    actor: {
      userId,
      kyneticRole: null,
      membership: { tenantId: svc.tenantId, role: 'owner', canExport: true, canBulkDelete: true },
      viewAs: null
    }
  };
}

export async function listServiceAutomations(tx: Tx, svc: ServiceContext) {
  const { ctx } = await ownerActor(tx, svc);
  return listAutomationTemplates(ctx, { tx });
}

export async function setServiceAutomation(
  tx: Tx,
  svc: ServiceContext,
  key: string,
  input: unknown
) {
  const parsed = enabledSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ body: ['enabled_required'] });
  const { ctx, actor } = await ownerActor(tx, svc);
  const modules = await loadEnabledModules(ctx, { tx });
  const row = await setAutomationEnabled(ctx, actor, key as never, parsed.data.enabled, modules, {
    tx
  });
  if (!row) throw new AppError('NOT_FOUND');
  return row;
}
