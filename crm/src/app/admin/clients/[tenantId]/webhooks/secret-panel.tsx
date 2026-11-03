'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { rotateLeadWebhookAction } from './actions';

export function SecretPanel({ tenantId, isSet }: { tenantId: string; isSet: boolean }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [issued, setIssued] = useState(isSet);
  const [pending, startTransition] = useTransition();
  return (
    <div className='max-w-xl space-y-4'>
      <p>
        Issuing a new signing secret invalidates the previous one immediately. Update the sender
        before resuming intake.
      </p>
      <Button
        disabled={pending}
        onClick={() => {
          if (
            issued &&
            !window.confirm(
              'Rotate this tenant’s signing secret? The current secret will stop working immediately.'
            )
          )
            return;
          setSecret(null);
          setMessage('');
          startTransition(async () => {
            try {
              const result = await rotateLeadWebhookAction(tenantId);
              if (result.ok) {
                setSecret(result.secret);
                setIssued(true);
              } else setMessage(result.message);
            } catch {
              setMessage(
                'The signing secret could not be changed. Check its status before trying again.'
              );
            }
          });
        }}
      >
        {pending ? 'Issuing…' : issued ? 'Rotate signing secret' : 'Issue signing secret'}
      </Button>
      {message && <p role='alert'>{message}</p>}
      {secret && (
        <div className='space-y-3' role='status'>
          <p>
            Save this signing secret now. It cannot be displayed again after you dismiss it or leave
            this page.
          </p>
          <code className='block break-all rounded border p-3 select-all'>{secret}</code>
          <Button variant='outline' onClick={() => setSecret(null)}>
            I saved it — dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
