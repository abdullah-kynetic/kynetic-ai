import PageContainer from '@/components/layout/page-container';
import { AutomationHistoryDrawer } from '@/components/automations/history-drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  automationHistory,
  EDITABLE_TEMPLATES,
  getAutomationEditState,
  listAutomationTemplates
} from '@/server/automations';
import { can } from '@/server/auth/permissions';
import { stageScope } from '@/server/deals';
import { headers } from 'next/headers';
import { decideEdit, proposeEdit, toggleAutomation } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automations' };

export default async function AutomationSettingsPage() {
  const { ctx, actor } = await stageScope(await headers());
  const canEdit = can(actor, 'automations.edit', ctx.tenantId);
  const canApprove = can(actor, 'automations.approve', ctx.tenantId);
  const templates = await listAutomationTemplates(ctx);
  const histories = await Promise.all(
    templates.map(async (template) => ({
      key: template.key,
      history: await automationHistory(ctx, template.key)
    }))
  );
  const byKey = new Map(histories.map((row) => [row.key, row.history]));
  const editable = new Set<string>(EDITABLE_TEMPLATES);
  const edits = new Map(
    await Promise.all(
      templates
        .filter((t) => editable.has(t.key))
        .map(async (t) => [t.key, await getAutomationEditState(ctx, t.key)] as const)
    )
  );
  return (
    <PageContainer
      pageTitle='Automations'
      pageDescription='Turn approved follow-up templates on or off, and see how recent runs finished.'
    >
      <div className='grid gap-4 md:grid-cols-2'>
        {templates.map(({ key, label, moduleKey, automation }) => {
          const history = byKey.get(key);
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle>{label}</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-4'>
                <p className='text-muted-foreground text-sm'>Module: {moduleKey ?? 'platform'}</p>
                {history ? (
                  <AutomationHistoryDrawer
                    label={label}
                    summary={history.summary}
                    runs={history.runs}
                  />
                ) : null}
                <form action={toggleAutomation.bind(null, key, !automation?.enabled)}>
                  <Button type='submit' variant={automation?.enabled ? 'outline' : 'default'}>
                    {automation?.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </form>
                {edits.get(key) ? (
                  <EditSection
                    templateKey={key}
                    state={edits.get(key)!}
                    canEdit={canEdit}
                    canApprove={canApprove}
                  />
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}

type EditState = Awaited<ReturnType<typeof getAutomationEditState>>;

function EditSection(props: {
  templateKey: string;
  state: EditState;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const { templateKey, state, canEdit, canApprove } = props;
  const pending = state.pending;
  const pendingSteps = (pending?.steps ?? []) as { delayMinutes: number; body: string }[];
  const shown = state.current.length
    ? state.current.map((s) => ({ delayMinutes: s.delayMinutes, body: s.body }))
    : [];
  return (
    <details className='grid gap-3 text-sm'>
      <summary className='cursor-pointer font-medium'>Messages and timing</summary>
      {pending ? (
        <div className='rounded-md border p-3'>
          <p className='font-medium'>Waiting for approval (version {pending.version})</p>
          <ol className='mt-2 list-decimal pl-5'>
            {pendingSteps.map((s, i) => (
              <li key={i}>
                After {Math.round(s.delayMinutes / 60)} h: {s.body}
              </li>
            ))}
          </ol>
          {canApprove ? (
            <div className='mt-3 flex gap-2'>
              <form action={decideEdit.bind(null, pending.id, true)}>
                <Button type='submit'>Approve</Button>
              </form>
              <form action={decideEdit.bind(null, pending.id, false)}>
                <Button type='submit' variant='outline'>
                  Reject
                </Button>
              </form>
            </div>
          ) : (
            <p className='text-muted-foreground mt-2'>
              Kynetic reviews changes before they go live. Nothing changes until then.
            </p>
          )}
        </div>
      ) : null}
      {canEdit ? (
        <form action={proposeEdit.bind(null, templateKey)} className='grid gap-3'>
          <p className='text-muted-foreground'>
            Up to six texts. The first must say &quot;Reply STOP to opt out&quot;. Texts still only
            go to people who agreed, never in quiet hours, and never to the do-not-call list.
          </p>
          {[1, 2, 3].map((n) => (
            <div key={n} className='grid gap-1'>
              <label htmlFor={`body_${n}_${templateKey}`}>Text {n}</label>
              <textarea
                id={`body_${n}_${templateKey}`}
                name={`body_${n}`}
                maxLength={320}
                rows={2}
                defaultValue={shown[n - 1]?.body ?? ''}
                className='rounded-md border p-2'
              />
              <label htmlFor={`delay_${n}_${templateKey}`}>Hours to wait before it</label>
              <input
                id={`delay_${n}_${templateKey}`}
                name={`delay_hours_${n}`}
                type='number'
                min={0}
                step='0.5'
                defaultValue={shown[n - 1] ? shown[n - 1]!.delayMinutes / 60 : n === 1 ? 0 : 24}
                className='w-28 rounded-md border p-2'
              />
            </div>
          ))}
          <Button type='submit' variant='outline'>
            Submit for approval
          </Button>
        </form>
      ) : null}
    </details>
  );
}
