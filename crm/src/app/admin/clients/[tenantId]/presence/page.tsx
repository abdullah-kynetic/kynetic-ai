import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { listPresence } from '@/server/presence';
import { saveItem } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPresencePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  const { items } = await listPresence({ tenantId, userId: access.user.id, role: 'admin', readOnly: true });
  return <PageContainer pageTitle='Online Presence' pageDescription='Track the work performed for this client.'>
    <form action={saveItem} className='grid max-w-2xl gap-3'>
      <input type='hidden' name='tenantId' value={tenantId} />
      <label>Title <input name='title' required maxLength={200} className='border-input w-full rounded border p-2' /></label>
      <label>Category <select name='kind' className='border-input w-full rounded border p-2'><option value='profile'>Business profile</option><option value='review_site'>Review site</option><option value='directory'>Directory</option><option value='social_post'>Social post</option></select></label>
      <label>Status <select name='status' className='border-input w-full rounded border p-2'><option value='planned'>Planned</option><option value='in_progress'>In progress</option><option value='done'>Done</option><option value='needs_attention'>Needs attention</option></select></label>
      <label>Notes <textarea name='notes' maxLength={5000} className='border-input w-full rounded border p-2' /></label>
      <button type='submit' className='bg-primary text-primary-foreground min-h-11 rounded px-4'>Add item</button>
    </form>
    <ul className='mt-8 max-w-2xl space-y-4'>{items.map((item) => <li key={item.id} className='rounded border p-4'>
      <form action={saveItem} className='grid gap-2'>
        <input type='hidden' name='tenantId' value={tenantId} /><input type='hidden' name='id' value={item.id} /><input type='hidden' name='kind' value={item.kind} /><input type='hidden' name='title' value={item.title} /><input type='hidden' name='notes' value={item.notes} />
        <label>{item.title} <select name='status' defaultValue={item.status} className='border-input ml-2 rounded border p-2'><option value='planned'>Planned</option><option value='in_progress'>In progress</option><option value='done'>Done</option><option value='needs_attention'>Needs attention</option></select></label>
        <button type='submit' className='min-h-11 rounded border px-4'>Save status</button>
      </form>
    </li>)}</ul>
  </PageContainer>;
}
