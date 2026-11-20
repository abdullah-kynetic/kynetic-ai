import { audit, type AuditInput } from '../audit';
import type { Tx } from '../db/client';
import type { ServiceContext } from './authenticate';

/**
 * Appends an audit_log row for a service-token call. A service call has no user, so the row's actor is
 * empty; the token id goes into `after` instead, which says which credential did it. Same transaction
 * as the write it describes. Call from inside withServiceTenant.
 */
export function auditService(tx: Tx, svc: ServiceContext, input: AuditInput): Promise<void> {
  const after =
    input.after && typeof input.after === 'object' && !Array.isArray(input.after)
      ? (input.after as Record<string, unknown>)
      : input.after === undefined
        ? {}
        : { value: input.after };
  return audit(tx, {
    ...input,
    after: {
      ...after,
      serviceTokenId: svc.tokenId,
      ...(svc.adminKeyId ? { adminKeyId: svc.adminKeyId } : {})
    }
  });
}
