'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import type { AdminChecklistStep } from '@/server/admin/checklist';
import * as React from 'react';
import { goLive, saveStep, type ChecklistState } from './actions';

const LABEL: Record<AdminChecklistStep['status'], string> = {
  todo: 'To do',
  doing: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  'n/a': 'Not needed'
};

const idle: ChecklistState = { status: 'idle' };

export function StepRow({
  tenantId,
  step,
  currentUserId
}: {
  tenantId: string;
  step: AdminChecklistStep;
  currentUserId: string;
}) {
  const [state, action, pending] = React.useActionState(saveStep, idle);
  const id = `step-${step.stepKey}`;
  return (
    <li className='border-b py-3 last:border-b-0'>
      <form
        action={action}
        className='grid gap-2 md:grid-cols-[minmax(0,1fr)_9rem_8rem_10rem_auto]'
      >
        <input type='hidden' name='tenantId' value={tenantId} />
        <input type='hidden' name='stepKey' value={step.stepKey} />
        <div className='min-w-0'>
          <p className='text-sm font-medium'>{step.title}</p>
          <p className='text-muted-foreground text-xs'>
            {step.clientVisible ? 'Shown to the owner' : 'Internal only'}
            {step.ownerName ? ` · ${step.ownerName}` : ''}
          </p>
          <Input
            name='note'
            aria-label={`Note for ${step.title}`}
            defaultValue={step.note ?? ''}
            maxLength={2000}
            placeholder='Internal note'
            className='mt-2'
          />
        </div>
        <NativeSelect
          name='status'
          aria-label={`Status of ${step.title}`}
          defaultValue={step.status}
        >
          {Object.entries(LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
        <Input
          id={`${id}-due`}
          name='dueDate'
          type='date'
          aria-label={`Due date for ${step.title}`}
          defaultValue={step.dueDate ?? ''}
        />
        <NativeSelect
          name='assign'
          aria-label={`Assigned to for ${step.title}`}
          defaultValue={
            step.ownerUserId === currentUserId ? 'me' : step.ownerUserId ? 'keep' : 'none'
          }
        >
          {step.ownerUserId && step.ownerUserId !== currentUserId && (
            <option value='keep'>{step.ownerName ?? 'Someone else'}</option>
          )}
          <option value='none'>Nobody</option>
          <option value='me'>Me</option>
        </NativeSelect>
        <div className='flex items-center gap-2'>
          <Button type='submit' size='sm' disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          {state.status === 'saved' && <Badge variant='success'>Saved</Badge>}
        </div>
      </form>
      {state.status === 'error' && (
        <p role='alert' className='text-destructive mt-2 text-sm'>
          {state.message}
        </p>
      )}
    </li>
  );
}

export function GoLiveButton({
  tenantId,
  openCount,
  canMark
}: {
  tenantId: string;
  openCount: number;
  canMark: boolean;
}) {
  const [state, action, pending] = React.useActionState(goLive, idle);
  return (
    <form action={action} className='flex flex-wrap items-center gap-3'>
      <input type='hidden' name='tenantId' value={tenantId} />
      <Button type='submit' disabled={pending || openCount > 0 || !canMark}>
        {pending ? 'Marking…' : 'Mark client live'}
      </Button>
      <span className='text-muted-foreground text-xs'>
        {!canMark
          ? 'Only an admin can mark a client live.'
          : openCount > 0
            ? `${openCount} step${openCount === 1 ? '' : 's'} still open. Done or not needed steps unlock this.`
            : 'Every step is done. The owner’s setup card disappears.'}
      </span>
      {state.status === 'error' && (
        <p role='alert' className='text-destructive w-full text-sm'>
          {state.message}
        </p>
      )}
    </form>
  );
}
