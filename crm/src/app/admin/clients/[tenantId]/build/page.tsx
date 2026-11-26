import { PortalPageContainer as PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { decideAdminAccess } from '@/server/admin';
import { BUILD_STAGES, derivePhase, listBuildSystems } from '@/server/admin/build-systems';
import { LIFECYCLE_STAGES, listClientLifecycle } from '@/server/admin/client-lifecycle';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { StartViewAsForm } from '../../../view-as/start-form';
import { loadClientRows } from '../../rows';
import {
  loadAutoBodyAction,
  moveStageAction,
  removeSystemAction,
  saveSystemAction
} from './actions';

export const metadata: Metadata = { title: 'Build stage' };
export const dynamic = 'force-dynamic';

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ');

export default async function ClientBuildPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const ctx = { userId: access.user.id, role: access.role };
  const [systems, stages] = await Promise.all([
    listBuildSystems(ctx, tenantId),
    listClientLifecycle(ctx)
  ]);
  const stage = stages.get(tenantId) ?? 'building';
  const client = (await loadClientRows()).rows.find((r) => r.tenantId === tenantId);
  const canEdit = access.role === 'admin';
  const select = 'bg-background min-h-11 rounded-[var(--radius-control)] border px-3 text-sm';
  return (
    <PageContainer
      pageTitle='Build stage'
      pageDescription='One stage per client. Building and Testing show the client a build progress page instead of the working pages. Live opens everything.'
    >
      {client && client.status !== 'suspended' && client.status !== 'offboarded' && (
        <section className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'>
          <h2 className='font-medium'>See it as the client does</h2>
          <p className='text-muted-foreground mt-1 mb-3 text-sm'>
            Opens this client&apos;s portal exactly as they will see it, at any stage.
          </p>
          <StartViewAsForm
            tenantId={tenantId}
            tenantName={client.name}
            reasonRequired={access.role !== 'admin'}
          />
        </section>
      )}
      <section className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'>
        <h2 className='font-medium'>Client stage</h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          Now: {label(stage)}.
          {systems.length > 0 && (stage === 'building' || stage === 'testing')
            ? ` By system progress this client looks like ${derivePhase(systems)}.`
            : ''}
          {systems.length === 0 &&
            ' No systems are listed, so the client still sees the normal portal.'}
        </p>
        {canEdit && (
          <form action={moveStageAction.bind(null, tenantId)} className='mt-3 flex flex-wrap gap-2'>
            <select name='stage' defaultValue={stage} className={select} aria-label='Client stage'>
              {LIFECYCLE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <Button type='submit'>Move client</Button>
          </form>
        )}
      </section>
      <section className='mt-4 grid gap-3'>
        <h2 className='font-medium'>Systems being built</h2>
        {systems.map((s) => (
          <form
            key={s.key}
            action={saveSystemAction.bind(null, tenantId)}
            className='bg-card grid gap-2 rounded-[var(--radius-card)] border p-4 sm:grid-cols-2'
          >
            <input type='hidden' name='key' value={s.key} />
            <input type='hidden' name='sortOrder' value={s.sortOrder} />
            <Input
              name='name'
              defaultValue={s.name}
              aria-label='Name'
              required
              disabled={!canEdit}
            />
            <select
              name='stage'
              defaultValue={s.stage}
              className={select}
              aria-label='Stage'
              disabled={!canEdit}
            >
              {BUILD_STAGES.map((b) => (
                <option key={b} value={b}>
                  {label(b)}
                </option>
              ))}
            </select>
            <Input
              name='outcome'
              defaultValue={s.outcome ?? ''}
              aria-label='What it does'
              placeholder='What it does for them'
              disabled={!canEdit}
            />
            <Input
              name='note'
              defaultValue={s.note ?? ''}
              aria-label='Note the client sees'
              placeholder='Note the client sees'
              disabled={!canEdit}
            />
            {canEdit && (
              <div className='flex gap-2 sm:col-span-2'>
                <Button type='submit'>Save</Button>
                <Button
                  type='submit'
                  variant='outline'
                  formAction={removeSystemAction.bind(null, tenantId, s.key)}
                >
                  Remove
                </Button>
              </div>
            )}
          </form>
        ))}
        {canEdit && (
          <>
            <form
              action={saveSystemAction.bind(null, tenantId)}
              className='grid gap-2 rounded-[var(--radius-card)] border border-dashed p-4 sm:grid-cols-2'
            >
              <Input
                name='name'
                aria-label='New system name'
                placeholder='New system name'
                required
              />
              <select name='stage' defaultValue='planned' className={select} aria-label='Stage'>
                {BUILD_STAGES.map((b) => (
                  <option key={b} value={b}>
                    {label(b)}
                  </option>
                ))}
              </select>
              <Input name='outcome' aria-label='What it does' placeholder='What it does for them' />
              <Input
                name='sortOrder'
                type='number'
                aria-label='Order'
                placeholder='Order'
                defaultValue={systems.length + 1}
              />
              <div className='sm:col-span-2'>
                <Button type='submit'>Add system</Button>
              </div>
            </form>
            {systems.length === 0 && (
              <form action={loadAutoBodyAction.bind(null, tenantId)}>
                <Button type='submit' variant='outline'>
                  Load the five auto body systems
                </Button>
              </form>
            )}
          </>
        )}
      </section>
    </PageContainer>
  );
}
