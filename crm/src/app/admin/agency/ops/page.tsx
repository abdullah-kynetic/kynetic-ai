import Link from 'next/link';
import PageContainer from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { agencyCaller } from '../caller';
import { getAgencyWorkspace } from '@/server/agency';
import { getAgencyOps, agencySecretStatus, agencyDigest } from '@/server/agency/ops';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import { saveOpsAction, rotateAgencySecretAction } from './actions';
export const dynamic = 'force-dynamic';
export default async function AgencyOps() {
  const caller = await agencyCaller();
  if (!(await getAgencyWorkspace(caller)))
    return <AgencyWorkspaceMissing pageTitle='Agency operations' />;
  const [{ clients, settings }, secret, digest] = await Promise.all([
    getAgencyOps(caller),
    agencySecretStatus(caller),
    agencyDigest(caller)
  ]);
  return (
    <PageContainer
      pageTitle='Agency operations'
      pageDescription='Client health, onboarding and isolated DEV configuration.'
    >
      <Link href='/admin/agency'>Agency dashboard</Link>
      <section className='agency-notice'>
        <h2 className='font-semibold'>Daily summary preview</h2>
        <p>{digest.body}</p>
        <p>In-app summaries at 8 a.m. Pacific. No external delivery.</p>
      </section>
      <section className='agency-health-list agency-list space-y-3'>
        <h2 className='font-semibold'>Client health</h2>
        {clients.map((c) => (
          <article className='rounded border p-3' key={c.tenantId}>
            <h3>{c.name}</h3>
            <p>
              {c.healthTone} · Score {c.healthScore} · {c.integrationErrors} integration errors ·{' '}
              {c.goLiveAt ? 'Live' : 'Onboarding'}
            </p>
            <Link href={`/admin/clients/${c.tenantId}/checklist`}>Onboarding checklist</Link>
          </article>
        ))}
      </section>
      <div className='agency-columns'>
        <form action={saveOpsAction} className='agency-form my-8'>
          <h2 className='font-semibold'>DEV integration draft</h2>
          <p>Saving metadata does not execute or activate a workflow or enable webhook dispatch.</p>
          <label htmlFor='ops-devWebhookUrl'>
            DEV lead webhook URL
            <Input
              id='ops-devWebhookUrl'
              name='devWebhookUrl'
              type='url'
              required
              defaultValue={
                settings?.dev_webhook_url ?? `https://dev.kyneticai.com${secret.leadPath}`
              }
            />
          </label>
          <label htmlFor='ops-workflowName'>
            Inactive DEV workflow name
            <Input
              id='ops-workflowName'
              name='workflowName'
              required
              defaultValue={settings?.workflow_name}
              placeholder='DEV - ...'
            />
          </label>
          <label htmlFor='ops-workflowId'>
            Workflow ID
            <Input
              id='ops-workflowId'
              name='workflowId'
              required
              defaultValue={settings?.workflow_id}
            />
          </label>
          <Button type='submit'>Save draft configuration</Button>
        </form>
        <section className='agency-panel space-y-3'>
          <h2 className='font-semibold'>Agency DEV lead secret</h2>
          <p>
            {secret.isSet ? '•••••••• (configured)' : 'Not configured'} · Last rotation{' '}
            {secret.rotatedAt ?? 'Never'}
          </p>
          <p>
            Rotation invalidates the previous signing secret. Secret values are never displayed
            here.
          </p>
          <form action={rotateAgencySecretAction}>
            <Button type='submit' variant='outline'>
              Rotate agency DEV secret
            </Button>
          </form>
        </section>
      </div>
    </PageContainer>
  );
}
