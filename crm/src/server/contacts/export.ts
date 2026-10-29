import { audit } from '../audit';
import type { Db } from '../db/client';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { can, type Actor } from '../auth/permissions';
import { searchContacts, searchContactsSchema, type SearchContactsInput } from './search';

const CSV_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'status',
  'source',
  'tags',
  'owner'
] as const;

/** Prevent spreadsheet formula execution when a CSV is opened in common office applications. */
export function neutralizeCsvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportContactsCsv(
  ctx: TenantContextInput,
  actor: Actor,
  input: SearchContactsInput,
  opts: { db?: Db } = {}
): Promise<string> {
  if (!can(actor, 'export.csv', ctx.tenantId)) throw new AppError('FORBIDDEN');
  const parsed = searchContactsSchema.parse(input);
  return withTenant(
    ctx,
    async (tx) => {
      await requireModule(ctx, 'crm', { level: 'full', tx });
      const rows = [];
      let page = 1;
      let pageCount = 1;
      do {
        const result = await searchContacts(ctx, { ...parsed, page, perPage: 50 }, { tx });
        rows.push(...result.rows);
        pageCount = result.pageCount;
        page++;
      } while (page <= pageCount);

      await audit(tx, {
        action: 'contact.export',
        entity: 'contact',
        after: {
          rows: rows.length,
          filtered: Boolean(
            parsed.q || parsed.statuses?.length || parsed.sources?.length || parsed.tags?.length
          )
        }
      });
      const lines = [CSV_FIELDS.map(neutralizeCsvCell).join(',')];
      for (const row of rows) {
        lines.push(
          [
            row.firstName,
            row.lastName,
            row.primaryPhoneE164,
            row.primaryEmail,
            row.status,
            row.source,
            row.tags.join('; '),
            row.ownerName
          ]
            .map(neutralizeCsvCell)
            .join(',')
        );
      }
      return `${lines.join('\r\n')}\r\n`;
    },
    opts
  );
}
