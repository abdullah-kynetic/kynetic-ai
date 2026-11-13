import PageContainer from '@/components/layout/page-container';
import { getNote } from '@/server/archive';
import { AppError } from '@/server/errors';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireArchiveStaff } from '../../archive-shared';

export const metadata: Metadata = { title: 'Archive note' };
export const dynamic = 'force-dynamic';

export default async function ArchiveNotePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireArchiveStaff();
  const { id } = await params;
  const note = await getNote(ctx, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === 'NOT_FOUND') return null;
    throw e;
  });
  if (!note) notFound();
  return (
    <PageContainer
      pageTitle={note.title}
      pageDescription={`Archived note · created ${note.createdOn}`}
    >
      <p className='mb-4 text-sm'>
        <Link href='/admin/archive/notes' className='text-foreground underline underline-offset-2'>
          Back to notes
        </Link>
      </p>
      <p className='text-muted-foreground mb-3 text-xs'>
        Twenty id {note.twentyId} · tag {note.tag}
        {note.updatedOn ? ` · updated ${note.updatedOn}` : ''}
        {note.superseded ? ' · superseded' : ''}
      </p>
      <pre className='bg-muted max-w-full rounded-lg p-4 text-sm break-words whitespace-pre-wrap'>
        {note.body}
      </pre>
    </PageContainer>
  );
}
