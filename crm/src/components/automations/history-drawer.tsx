'use client';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import type { AutomationRunView, AutomationSummary } from '@/server/automations/history';

const BUCKET_LABEL = {
  reply: 'Stopped because they replied',
  booking: 'Stopped because an estimate was booked',
  opt_out: 'Stopped because they opted out',
  other: 'Stopped'
} as const;

export function AutomationHistoryDrawer({
  label,
  summary,
  runs
}: {
  label: string;
  summary: AutomationSummary;
  runs: AutomationRunView[];
}) {
  return (
    <div className='grid gap-3'>
      <dl className='grid grid-cols-2 gap-2 text-sm'>
        <div>
          <dt className='text-muted-foreground'>Runs in the last 30 days</dt>
          <dd className='font-medium'>{summary.runs}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>Completed</dt>
          <dd className='font-medium'>{summary.completed}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>Stopped</dt>
          <dd className='font-medium'>
            Reply {summary.stopped.reply}, booking {summary.stopped.booking}, opt-out{' '}
            {summary.stopped.optOut}
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground'>Failed</dt>
          <dd className='font-medium'>{summary.failed}</dd>
        </div>
        <div className='col-span-2'>
          <dt className='text-muted-foreground'>Last run</dt>
          <dd className='font-medium'>
            {summary.lastRunAt ? new Date(summary.lastRunAt).toLocaleString() : 'None yet'}
          </dd>
        </div>
      </dl>
      <Sheet>
        <SheetTrigger render={<Button variant='outline'>View history</Button>} />
        <SheetContent className='overflow-y-auto sm:max-w-md'>
          <SheetHeader>
            <SheetTitle>{label} history</SheetTitle>
            <SheetDescription>The last 50 runs. This is read-only.</SheetDescription>
          </SheetHeader>
          {runs.length === 0 ? (
            <p className='text-muted-foreground px-4'>No runs yet.</p>
          ) : (
            <ol className='grid gap-4 px-4 pb-6'>
              {runs.map((run) => (
                <li key={run.id} className='rounded border p-3'>
                  <p className='font-medium'>
                    {run.bucket ? BUCKET_LABEL[run.bucket] : run.status.replaceAll('_', ' ')}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Started {new Date(run.createdAt).toLocaleString()}
                    {run.stopReason ? ` · ${run.stopReason}` : ''}
                  </p>
                  <ol className='mt-2 grid gap-1 text-sm'>
                    {run.steps.map((step) => (
                      <li key={step.position}>
                        Step {step.position} · {step.channel} · {step.status}
                        {step.at ? ` · ${new Date(step.at).toLocaleString()}` : ''}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
