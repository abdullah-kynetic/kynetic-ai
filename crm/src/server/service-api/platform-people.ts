import { z } from 'zod';
import { auditFiltersSchema, searchAuditLog } from '../admin/audit-viewer';
import { auditManualBackup, listBackups } from '../admin/backups';
import { changeStaffRole, deactivateUser, listUsers, reactivateUser } from '../admin/users';
import { AppError } from '../errors';
import {
  getStaffSupportThread,
  listSupportQueue,
  replyAsStaff,
  setSupportRequestStatus
} from '../support/service';
import { parseInput, uuidSchema } from '../validation';
import { platformContext, type PlatformService } from '../service-auth/platform';

// Staff, support, audit and backups for the service API (E4). Owner's admin key only. Not exposed here,
// on purpose: inviting staff (sends email), resetting a client user, impersonation, backup restore and
// decrypt, system settings, and anything under the admin API keys page. Keys are never managed through the
// API itself.

const staffCaller = (plat: PlatformService) => ({ id: plat.userId, kyneticRole: 'admin' as const });
const staffCtx = (plat: PlatformService) => ({ userId: plat.userId, role: 'admin' as const });
const roleSchema = z.strictObject({ role: z.enum(['admin', 'va']).nullable() });
const statusSchema = z.strictObject({ status: z.string().trim().min(1).max(40) });
const replySchema = z.unknown();

/** The owner's own account and the account behind this key cannot have their role or access changed here. */
function notSelf(plat: PlatformService, userId: string) {
  parseInput(uuidSchema, userId);
  // The owner is the one account behind the key. The API never deactivates or re-roles it, so no
  // admin reached through this key can demote or lock out the owner.
  if (userId === plat.userId)
    throw new AppError('FORBIDDEN', {
      message: 'The owner account cannot be changed through the API.'
    });
}

export async function listServiceUsers(plat: PlatformService, query: Record<string, string>) {
  const input: { tenantId?: string; search?: string } = {};
  if (query.tenantId) input.tenantId = query.tenantId;
  if (query.search) input.search = query.search;
  return listUsers(staffCaller(plat), input);
}

export async function deactivateServiceUser(plat: PlatformService, id: string) {
  notSelf(plat, id);
  await deactivateUser(staffCaller(plat), id);
  return { deactivated: true };
}

export async function reactivateServiceUser(plat: PlatformService, id: string) {
  notSelf(plat, id);
  await reactivateUser(staffCaller(plat), id);
  return { reactivated: true };
}

export async function setServiceStaffRole(plat: PlatformService, id: string, body: unknown) {
  notSelf(plat, id);
  const { role } = parseInput(roleSchema, body);
  await changeStaffRole(staffCaller(plat), { userId: id, role });
  return { updated: true };
}

export async function listPlatformSupport(plat: PlatformService, query: Record<string, string>) {
  return listSupportQueue(staffCtx(plat), {
    category: (query.category as never) ?? null,
    status: (query.status as never) ?? null
  });
}

export async function getPlatformSupportThread(plat: PlatformService, id: string) {
  parseInput(uuidSchema, id);
  const thread = await getStaffSupportThread(staffCtx(plat), id);
  if (!thread) throw new AppError('NOT_FOUND');
  return thread;
}

export async function replyPlatformSupport(plat: PlatformService, id: string, body: unknown) {
  parseInput(uuidSchema, id);
  parseInput(replySchema, body);
  return replyAsStaff(staffCtx(plat), id, body);
}

export async function setPlatformSupportStatus(plat: PlatformService, id: string, body: unknown) {
  parseInput(uuidSchema, id);
  const { status } = parseInput(statusSchema, body);
  return setSupportRequestStatus(staffCtx(plat), id, status);
}

/** Audit search. Key hashes and admin key rows are removed from the result. */
export async function searchServiceAudit(plat: PlatformService, query: Record<string, string>) {
  const filters = parseInput(auditFiltersSchema, query);
  const page = await searchAuditLog(platformContext(plat), filters);
  return redactAudit(page);
}

const HASH_KEYS = /^(key_?hash|keyhash|hash|token_?hash)$/i;

function redactAudit(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter(
        (row) =>
          !(
            row &&
            typeof row === 'object' &&
            /admin_api_key|api_key/i.test(String((row as { entity?: unknown }).entity ?? ''))
          )
      )
      .map(redactAudit);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !HASH_KEYS.test(k))
        .map(([k, v]) => [k, redactAudit(v)])
    );
  }
  return value;
}

export async function listServiceBackups(plat: PlatformService) {
  return listBackups(staffCtx(plat));
}

/** Queues one manual backup, the same as the admin backups page. */
export async function runServiceBackup(plat: PlatformService) {
  await auditManualBackup(staffCtx(plat));
  return { queued: true };
}
