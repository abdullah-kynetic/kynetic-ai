/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- scrollable table regions must be keyboard focusable (WCAG 2.1.1) */
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { decideAdminAccess, listBackups } from '@/server/admin';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { startBackup } from './actions';

export const dynamic = 'force-dynamic';

export default async function BackupsPage() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const rows = await listBackups({ userId: access.user.id, role: access.role });
  return (
    <PageContainer
      pageTitle='Backups'
      pageDescription='Encrypted database backup history and restore test status.'
      pageHeaderAction={
        access.role === 'admin' ? (
          <form action={startBackup}>
            <Button type='submit'>Run backup</Button>
          </form>
        ) : undefined
      }
    >
      <div
        className='overflow-x-auto rounded border'
        role='region'
        aria-label='Backup history'
        tabIndex={0}
      >
        <table className='w-full text-left text-sm'>
          <thead>
            <tr>
              <th className='p-3'>Started</th>
              <th className='p-3'>Kind</th>
              <th className='p-3'>Status</th>
              <th className='p-3'>Encrypted size</th>
              <th className='p-3'>Restore drill</th>
              <th className='p-3'>Object key</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className='border-t' key={row.id}>
                <td className='p-3'>{new Date(row.startedAt).toLocaleString()}</td>
                <td className='p-3'>{row.kind}</td>
                <td className='p-3'>{row.status}</td>
                <td className='p-3'>{row.sizeBytes ?? '—'}</td>
                <td className='p-3'>
                  {row.restoreTestPassed === null
                    ? 'Not run'
                    : row.restoreTestPassed
                      ? 'Passed'
                      : 'Failed'}
                </td>
                <td className='p-3'>{row.offsiteKey ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className='p-4'>
                  No backups have run.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
