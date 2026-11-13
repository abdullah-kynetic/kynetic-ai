import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { getStorage, type StorageAdapter } from '../adapters/storage';
import type { Db } from '../db/client';
import { AppError } from '../errors';
import { withPlatform, type PlatformContext } from '../tenancy';

/**
 * Staff-only download link for an archive attachment. The link is the storage adapter's signed GET
 * URL, which lives five minutes (SIGNED_URL_TTL_S) and cannot be given another lifetime. A missing
 * row, a file not copied in yet and a key outside `archive/` all answer NOT_FOUND.
 */
export async function getArchiveAttachmentUrl(
  ctx: PlatformContext,
  attachmentId: string,
  opts: { db?: Db; storage?: StorageAdapter } = {}
): Promise<{ url: string; fileName: string }> {
  if (ctx.role !== 'admin' && ctx.role !== 'va') throw new AppError('FORBIDDEN');
  const id = z.uuid().safeParse(attachmentId);
  if (!id.success) throw new AppError('NOT_FOUND');
  const [row] = Array.from(
    (await withPlatform(
      ctx,
      (tx) =>
        tx.execute(
          sql`select file_name, file_key from archive_attachments where id = ${id.data}::uuid`
        ),
      opts
    )) as unknown as Array<{ file_name: string; file_key: string | null }>
  );
  if (!row?.file_key || !row.file_key.startsWith('archive/')) throw new AppError('NOT_FOUND');
  const url = await (opts.storage ?? getStorage()).signedGetUrl(row.file_key);
  return { url, fileName: row.file_name };
}
