import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { decideAdminAccess } from '@/server/admin';
import { alexConfigs } from '@/server/db/schema';
import { withTenant } from '@/server/tenancy';
import { placeAlexTestCallAction, updateAlexConfigAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminAlexConfigPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  const config = await withTenant(
    { tenantId, userId: access.user.id, role: 'admin' },
    async (tx) =>
      (
        await tx
          .select({
            provider: alexConfigs.provider,
            agentRef: alexConfigs.agentRef,
            voice: alexConfigs.voice,
            greeting: alexConfigs.greeting,
            transferNumberE164: alexConfigs.transferNumberE164,
            paused: alexConfigs.paused,
            promptVersion: alexConfigs.promptVersion
          })
          .from(alexConfigs)
          .where(eq(alexConfigs.tenantId, tenantId))
          .limit(1)
      )[0]
  );
  if (!config) notFound();
  return (
    <PageContainer
      pageTitle='Alex configuration'
      pageDescription={`Provider, call settings and prompt version ${config.promptVersion}. Changes are audited.`}
    >
      <form action={updateAlexConfigAction.bind(null, tenantId)} className='max-w-xl space-y-5'>
        <div className='space-y-2'>
          <Label htmlFor='provider'>Provider</Label>
          <select
            id='provider'
            name='provider'
            defaultValue={config.provider}
            className='bg-background border-input min-h-11 w-full rounded-md border px-3'
          >
            <option value='elevenlabs'>ElevenLabs</option>
            <option value='retell'>Retell</option>
          </select>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='agentRef'>Agent reference</Label>
          <Input id='agentRef' name='agentRef' defaultValue={config.agentRef ?? ''} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='voice'>Voice reference</Label>
          <Input id='voice' name='voice' defaultValue={config.voice ?? ''} />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='greeting'>Greeting</Label>
          <textarea
            id='greeting'
            name='greeting'
            defaultValue={config.greeting ?? ''}
            className='border-input bg-background min-h-24 w-full rounded-md border p-3'
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='transferNumberE164'>Transfer number (E.164)</Label>
          <Input
            id='transferNumberE164'
            name='transferNumberE164'
            defaultValue={config.transferNumberE164 ?? ''}
          />
        </div>
        <label className='flex min-h-11 items-center gap-3'>
          <input type='checkbox' name='paused' defaultChecked={config.paused} /> Pause Alex for this
          client
        </label>
        <div className='space-y-2'>
          <Label htmlFor='prompt'>New prompt (optional)</Label>
          <textarea
            id='prompt'
            name='prompt'
            className='border-input bg-background min-h-40 w-full rounded-md border p-3'
          />
          <p className='text-muted-foreground text-sm'>
            Saving a prompt creates the next version; the raw prompt is not shown here.
          </p>
        </div>
        <Button type='submit'>Save Alex settings</Button>
      </form>
      <form
        action={placeAlexTestCallAction.bind(null, tenantId)}
        className='mt-10 flex max-w-xl flex-wrap items-end gap-3'
      >
        <div className='min-w-56 flex-1 space-y-2'>
          <Label htmlFor='test-phone'>Test call destination</Label>
          <Input id='test-phone' name='phone' type='tel' placeholder='+15555550123' required />
        </div>
        <Button type='submit' variant='outline'>
          Place test call
        </Button>
        <p className='text-muted-foreground basis-full text-sm'>
          Uses the configured voice adapter and writes an audit record.
        </p>
      </form>
    </PageContainer>
  );
}
