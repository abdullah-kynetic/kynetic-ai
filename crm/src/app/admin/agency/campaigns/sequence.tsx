import { agencyDateTime, agencyChannel } from '@/components/agency/format';
import { AgencyStatus } from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { agencyCampaignStats, listAgencyCampaignTasks } from '@/server/agency/campaign-engine';
import type { CampaignStep } from '@/server/agency/campaign-policy';
import type { StaffCaller } from '@/server/admin/users';
import {
  saveSequence,
  enrollSequence,
  completeSequence,
  skipSequence,
  rescheduleSequence
} from './sequence-actions';
import { productionSimulationRefused } from '@/server/agency/production-guard';
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
              <label htmlFor={`sequence-${id}-delay${n}`}>
                Days after prior step
                <Input
                  id={`sequence-${id}-delay${n}`}
                  type='number'
                  name={`delay${n}`}
                  min={0}
                  max={365}
                  defaultValue={steps[n]?.delayDays ?? 0}
                />
              </label>
              <label htmlFor={`sequence-${id}-instructions${n}`}>
                Task instructions
                <Input
                  id={`sequence-${id}-instructions${n}`}
                  name={`instructions${n}`}
                  required={!n}
                  maxLength={2000}
                  defaultValue={steps[n]?.instructions}
                />
              </label>
            </fieldset>
          ))}
          <Button type='submit' variant='outline'>
            Save sequence
          </Button>
        </form>
      )}
      {!!steps.length && (
        <form action={enrollSequence.bind(null, id)}>
          <Button type='submit' variant='outline'>
            Enroll assigned leads
          </Button>
        </form>
      )}
      <p>
        {stats.map((s) => `${s.result.replaceAll('_', ' ')}: ${s.count}`).join(' · ') ||
          'No completed steps.'}
      </p>
      <div className='agency-task-list'>
        {tasks.map((t) => (
          <article key={t.contact_id}>
            <div className='agency-task-heading'>
              <h4>{t.name}</h4>
              <AgencyStatus value={t.state} />
            </div>
            <p className='agency-task-meta'>
              {t.state === 'complete' ? 'Sequence complete' : `Step ${t.step_index + 1}`} · Due{' '}
              <time dateTime={t.due_at}>{agencyDateTime(t.due_at)}</time>
              {t.stop_reason && ` · ${t.stop_reason.replaceAll('_', ' ')}`}
            </p>
            {steps[t.step_index] && (
              <p>
                {agencyChannel(steps[t.step_index].channel)}: {steps[t.step_index].instructions}
              </p>
            )}
            {t.state === 'active' && (
              <div className='flex flex-wrap items-end gap-3'>
                {!productionSimulationRefused() && (
                  <form
                    action={completeSequence.bind(null, id, t.contact_id, t.step_index, 'simulate')}
                  >
                    <Button type='submit' variant='outline'>
                      Simulate step
                    </Button>
                  </form>
                )}
                <form action={completeSequence.bind(null, id, t.contact_id, t.step_index, 'done')}>
                  <Button type='submit' variant='outline'>
                    Mark done
                  </Button>
                </form>
                <form
                  action={skipSequence.bind(null, id, t.contact_id, t.step_index)}
                  className='flex flex-wrap items-end gap-2'
                >
                  <Label htmlFor={`skip-${t.contact_id}`}>Skip reason</Label>
                  <Input id={`skip-${t.contact_id}`} name='reason' required maxLength={500} />
                  <Button type='submit' variant='outline'>
                    Skip
                  </Button>
                </form>
                <form
                  action={rescheduleSequence.bind(null, id, t.contact_id, t.step_index)}
                  className='flex flex-wrap items-end gap-2'
                >
                  <Label htmlFor={`date-${t.contact_id}`}>New date</Label>
                  <Input id={`date-${t.contact_id}`} name='callbackDate' type='date' required />
                  <Label htmlFor={`time-${t.contact_id}`}>New time</Label>
                  <Input id={`time-${t.contact_id}`} name='callbackTime' type='time' required />
                  <Button type='submit' variant='outline'>
                    Reschedule
                  </Button>
                </form>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
