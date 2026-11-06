import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { agencyCampaignStats, listAgencyCampaignTasks } from '@/server/agency/campaign-engine';
import type { CampaignStep } from '@/server/agency/campaign-policy';
import type { StaffCaller } from '@/server/admin/users';
import { saveSequence, enrollSequence, completeSequence } from './sequence-actions';
export async function CampaignSequence({
  caller,
  id,
  steps
}: {
  caller: StaffCaller;
  id: string;
  steps: CampaignStep[];
}) {
  const [tasks, stats] = await Promise.all([
    listAgencyCampaignTasks(caller, id),
    agencyCampaignStats(caller, id)
  ]);
  return (
    <section className='space-y-4'>
      <h3 className='font-semibold'>Manual follow-up sequence</h3>
      <p>No automatic sends. Stops on reply, booking, opt-out, or a closed deal.</p>
      {!tasks.length && (
        <form action={saveSequence.bind(null, id)} className='space-y-3'>
          {[0, 1, 2, 3].map((n) => (
            <fieldset key={n} className='flex flex-wrap gap-3 border p-3'>
              <legend>
                Step {n + 1}
                {n ? ' (optional)' : ''}
              </legend>
              <label>
                Channel
                <select name={`channel${n}`} defaultValue={steps[n]?.channel ?? 'call'}>
                  {['call', 'sms', 'email', 'dm'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Days after prior step
                <Input
                  type='number'
                  name={`delay${n}`}
                  min={0}
                  max={365}
                  defaultValue={steps[n]?.delayDays ?? 0}
                />
              </label>
              <label>
                Task instructions
                <Input
                  name={`instructions${n}`}
                  required={!n}
                  maxLength={2000}
                  defaultValue={steps[n]?.instructions}
                />
              </label>
            </fieldset>
          ))}
          <Button variant='outline'>Save sequence</Button>
        </form>
      )}
      {!!steps.length && (
        <form action={enrollSequence.bind(null, id)}>
          <Button variant='outline'>Enroll assigned leads</Button>
        </form>
      )}
      <p>
        {stats.map((s) => `${s.result.replaceAll('_', ' ')}: ${s.count}`).join(' · ') ||
          'No completed steps.'}
      </p>
      {tasks.map((t) => (
        <article key={t.contact_id} className='rounded border p-3'>
          <p>
            {t.name} · {t.state} {t.stop_reason ?? ''} · Step {t.step_index + 1} · Due{' '}
            {String(t.due_at)}
          </p>
          {steps[t.step_index] && (
            <p>
              {steps[t.step_index].channel}: {steps[t.step_index].instructions}
            </p>
          )}
          {t.state === 'active' && (
            <div className='flex gap-3'>
              <form
                action={completeSequence.bind(null, id, t.contact_id, t.step_index, 'simulate')}
              >
                <Button variant='outline'>Simulate step</Button>
              </form>
              <form
                action={completeSequence.bind(
                  null,
                  id,
                  t.contact_id,
                  t.step_index,
                  'manual_complete'
                )}
              >
                <Button variant='outline'>Mark manually completed</Button>
              </form>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
