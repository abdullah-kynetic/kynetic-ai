'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { pauseOutboundAction, resumeOutboundAction } from './actions';

export function PauseControls({
  envEnabled,
  paused,
  reason,
  pausedAt
}: {
  envEnabled: boolean;
  paused: boolean;
  reason: string | null;
  pausedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const env = envEnabled ? 'on' : 'off';
  const portal = paused ? 'paused' : 'running';
  return (
    <section className='mb-8 space-y-3' aria-labelledby='pause-heading'>
      <h2 id='pause-heading' className='text-lg font-semibold'>
        Outbound pause
      </h2>
      <p>
        Env: {env} · Portal: {portal}
      </p>
      <p className='text-muted-foreground text-sm'>
        The environment switch stays off until someone changes the server. This button can only add
        a pause. It cannot turn sending on.
      </p>
      {paused && (
        <p>
          Paused {pausedAt ?? ''}. {reason ? `Reason: ${reason}` : ''}
        </p>
      )}
      {paused ? (
        <>
          <button
            className='min-h-11 rounded border px-3'
            type='button'
            onClick={() => setOpen(true)}
          >
            Resume calls and texts
          </button>
          <Modal
            isOpen={open}
            onClose={() => setOpen(false)}
            title='Resume calls and texts?'
            description='The portal pause lifts. If the environment switch is off, nothing is sent.'
          >
            <form action={resumeOutboundAction}>
              <button className='min-h-11 rounded border px-3' type='submit'>
                Yes, resume
              </button>
            </form>
          </Modal>
        </>
      ) : (
        <form action={pauseOutboundAction} className='grid max-w-md gap-3'>
          <label className='grid gap-1'>
            Reason
            <input
              className='min-h-11 rounded border px-3'
              name='reason'
              required
              maxLength={500}
            />
          </label>
          <button className='min-h-11 rounded border px-3' type='submit'>
            Pause all calls and texts
          </button>
        </form>
      )}
    </section>
  );
}
