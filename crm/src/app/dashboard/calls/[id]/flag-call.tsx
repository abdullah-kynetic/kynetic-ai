'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { flagCallAction } from './actions';

export function FlagCall({
  callId,
  flagged,
  flagNote
}: {
  callId: string;
  flagged: boolean;
  flagNote: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  if (flagged) {
    return (
      <StatusBadge tone='warning' title={flagNote ?? undefined}>
        Flagged for Kynetic review
      </StatusBadge>
    );
  }

  const submit = () =>
    start(async () => {
      const r = await flagCallAction(callId, reason);
      if (!r.ok) {
        notify.error(r.message);
        return;
      }
      notify.success('Flagged for Kynetic review');
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='outline'>Flag for Kynetic review</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag this call for Kynetic review</DialogTitle>
          <DialogDescription>
            Kynetic listens to flagged calls and uses them to improve Alex.
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='flag-reason'>Reason (optional)</Label>
          <Textarea
            id='flag-reason'
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
            placeholder='What went wrong?'
          />
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            Flag call
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
