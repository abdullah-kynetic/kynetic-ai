/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- scrollable table regions must be keyboard focusable (WCAG 2.1.1) */
import PageContainer from '@/components/layout/page-container';
import { listAttachments } from '@/server/archive';
import type { Metadata } from 'next';
import { ArchiveTabs, Banner, requireArchiveStaff } from '../archive-shared';

export const metadata: Metadata = { title: 'Archive attachments' };
export const dynamic = 'force-dynamic';

function size(n: number | null) {
  if (n == null) return '-';
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

export default async function ArchiveAttachmentsPage() {
  const ctx = await requireArchiveStaff();
  const rows = await listAttachments(ctx);
  return (
    <PageContainer
      pageTitle='Archive'
      pageDescription='Old Twenty notes, tasks, files and records. Staff only.'
    >
      <ArchiveTabs current='/admin/archive/attachments' />
      <Banner />
      <div
        className='overflow-x-auto rounded-lg border'
        role='region'
        aria-label='Attachments'
        tabIndex={0}
      >
        <table className='w-full text-left text-sm'>
          <thead>
            <tr>
              <th scope='col' className='p-3'>
                File
              </th>
              <th scope='col' className='p-3'>
                Type
              </th>
              <th scope='col' className='p-3'>
                Size
              </th>
              <th scope='col' className='p-3'>
                Download
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className='border-t'>
                <td className='p-3 font-medium break-all'>{a.fileName}</td>
                <td className='p-3'>{a.contentType}</td>
                <td className='p-3 whitespace-nowrap'>{size(a.sizeBytes)}</td>
                <td className='p-3'>
                  {a.available ? (
                    <a
                      href={`/api/admin/archive/attachments/${a.id}/download`}
                      className='text-foreground underline underline-offset-2'
                    >
                      Download<span className='sr-only'> {a.fileName}</span>
                    </a>
                  ) : (
                    <span className='text-muted-foreground'>File not copied in yet</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className='p-4'>
                  Nothing imported yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
