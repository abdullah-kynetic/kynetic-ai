import { eq } from 'drizzle-orm';
import { auditRuns } from '@/server/db/schema';
import { errorResponse } from '@/server/errors';
import { parseJsonBody } from '@/server/validation';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { z } from 'zod';

const inputSchema = z.strictObject({
  idempotencyKey: z.string().trim().min(1).max(200),
  contactId: z.uuid().optional(), companyId: z.uuid().optional(),
  mode: z.enum(['free', 'full', 'operator']), scores: z.record(z.string(), z.unknown()),
  findings: z.array(z.unknown()), pdfKey: z.string().max(500).nullable().optional(),
  costCents: z.number().int().min(0).default(0)
});

export const POST = withServiceAuth(async (request, svc) => {
  try {
    const input = await parseJsonBody(request, inputSchema);
    const row = await withServiceTenant(svc, async (tx) => {
      const inserted = await tx.insert(auditRuns).values({
        tenantId: svc.tenantId, idempotencyKey: input.idempotencyKey, contactId: input.contactId,
        companyId: input.companyId, mode: input.mode, scores: input.scores, findings: input.findings,
        pdfKey: input.pdfKey, costCents: input.costCents
      }).onConflictDoNothing({ target: [auditRuns.tenantId, auditRuns.idempotencyKey] }).returning();
      if (inserted[0]) return inserted[0];
      const [existing] = await tx.select().from(auditRuns).where(eq(auditRuns.idempotencyKey, input.idempotencyKey)).limit(1);
      return existing;
    });
    return Response.json({ ok: true, data: row }, { status: 200 });
  } catch (error) { return errorResponse(error); }
}, { requiredScope: 'write-audit-results' });

