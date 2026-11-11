import { z } from 'zod';
import type { Db } from '../db/client';
import { getOptionalStorage, type StorageAdapter } from '../adapters/storage';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';
import { getReport } from './service';
import { computeReportContent, reportContentSchema } from './content';

export async function getReportDetail(
  ctx: TenantContextInput,
  id: string,
  opts: { db?: Db; storage?: StorageAdapter | null } = {}
) {
  await requireModule(ctx, 'platform', { db: opts.db });
  const reportId = parseInput(z.uuid(), id);
  return withTenant(
    ctx,
    async (tx) => {
      const report = await getReport(ctx, reportId, { tx });
      if (!report) return null;
      // Never trust the stored key to select an object belonging to another tenant.
      const storage = opts.storage === undefined ? getOptionalStorage() : opts.storage;
      const object = await storage?.get(`${ctx.tenantId}/reports/${report.periodStart}.json`);
      if (!object)
        return {
          report,
          content: await computeReportContent(ctx, report.periodStart, tx),
          source: 'Computed from daily metrics'
        };
      const artifact = reportContentSchema.parse(JSON.parse(new TextDecoder().decode(object.body)));
      if (artifact.periodStart !== report.periodStart)
        throw new Error('Report artifact period mismatch');
      const sections = artifact.sections;
      const complete =
        sections.daily &&
        sections.guarantee &&
        sections.performance.data.reached !== undefined &&
        sections.performance.data.won !== undefined;
      const fallback = complete ? null : await computeReportContent(ctx, report.periodStart, tx);
      return {
        report,
        content: {
          ...artifact,
          sections: {
            ...sections,
            performance: {
              data: { ...fallback?.sections.performance.data, ...sections.performance.data }
            },
            daily: sections.daily ?? fallback!.sections.daily,
            guarantee: sections.guarantee ?? fallback!.sections.guarantee
          }
        },
        source: complete
          ? 'Generated report'
          : 'Generated report; additional metrics computed from daily metrics'
      };
    },
    { db: opts.db }
  );
}
