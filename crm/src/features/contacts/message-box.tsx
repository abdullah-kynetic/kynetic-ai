'use client';

import { sendMessageAction } from '@/app/dashboard/contacts/[id]/message-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export type ThreadItem = {
  id: string;
  channel: 'sms' | 'email';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  status: string;
  at: string;
};

export type ChannelAvailability = {
  channel: 'sms' | 'email';
  canSend: boolean;
  message: string | null;
};

const LABEL = { sms: 'Text', email: 'Email' } as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  });

/** The conversation with this contact plus the box to send the next message (F-47). */
export function MessageBox({
  contactId,
  thread,
  channels,
  canWrite
}: {
  contactId: string;
  thread: ThreadItem[];
  channels: ChannelAvailability[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const firstOpen = channels.find((c) => c.canSend)?.channel ?? 'sms';
  const [channel, setChannel] = React.useState<'sms' | 'email'>(firstOpen);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [sentNote, setSentNote] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const state = channels.find((c) => c.channel === channel);

  function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSentNote(null);
    startTransition(async () => {
      const result = await sendMessageAction(contactId, channel, subject, body);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBody('');
      setSubject('');
      setSentNote('Sent.');
      router.refresh();
    });
  }

  return (
    <div className='flex flex-col gap-4'>
      {thread.length ? (
        <ol className='flex max-h-96 flex-col gap-2 overflow-y-auto' aria-label='Conversation'>
          {thread.map((m) => (
            <li
              key={m.id}
              className={cn(
                'max-w-[85%] rounded-lg border px-3 py-2 text-sm',
                m.direction === 'outbound' ? 'bg-muted self-end' : 'bg-card self-start'
              )}
            >
              <p className='text-muted-foreground text-xs'>
                {m.direction === 'outbound' ? 'You' : 'Them'} · {LABEL[m.channel]} · {when(m.at)}
                {m.direction === 'outbound' && m.status !== 'sent' && m.status !== 'delivered'
                  ? ` · ${m.status}`
                  : ''}
              </p>
              {m.subject ? <p className='font-medium'>{m.subject}</p> : null}
              <p className='whitespace-pre-wrap'>{m.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className='text-muted-foreground text-sm'>No messages yet.</p>
      )}

      {canWrite ? (
        <form onSubmit={send} className='flex flex-col gap-3'>
          <fieldset className='flex gap-2'>
            <legend className='sr-only'>Send by</legend>
            {channels.map((c) => (
              <Button
                key={c.channel}
                type='button'
                size='sm'
                variant={channel === c.channel ? 'default' : 'outline'}
                aria-pressed={channel === c.channel}
                onClick={() => setChannel(c.channel)}
              >
                {LABEL[c.channel]}
              </Button>
            ))}
          </fieldset>
          {state && !state.canSend ? (
            <p
              className='border-border bg-muted rounded-lg border px-3 py-2 text-sm'
              role='status'
              data-testid='compose-blocked'
            >
              {state.message}
            </p>
          ) : null}
          {channel === 'email' ? (
            <label htmlFor='compose-subject' className='flex flex-col gap-1 text-sm font-medium'>
              Subject
              <Input
                id='compose-subject'
                value={subject}
                maxLength={200}
                onChange={(e) => setSubject(e.target.value)}
                disabled={pending || !state?.canSend}
              />
            </label>
          ) : null}
          <label htmlFor='compose-body' className='flex flex-col gap-1 text-sm font-medium'>
            {channel === 'email' ? 'Message' : 'Text message'}
            <Textarea
              id='compose-body'
              value={body}
              maxLength={channel === 'email' ? 5000 : 1000}
              onChange={(e) => setBody(e.target.value)}
              disabled={pending || !state?.canSend}
            />
          </label>
          <div className='flex items-center gap-3'>
            <Button
              type='submit'
              disabled={pending || !state?.canSend || !body.trim()}
              className='min-h-11'
            >
              {pending ? 'Sending…' : `Send ${LABEL[channel].toLowerCase()}`}
            </Button>
            {sentNote ? (
              <span className='text-muted-foreground text-sm' role='status'>
                {sentNote}
              </span>
            ) : null}
          </div>
          {error ? (
            <p className='text-destructive text-sm' role='alert'>
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
