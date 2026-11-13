'use client';

import {
  approveDraftAction,
  createBriefAction,
  decideFactAction,
  draftMessageAction,
  rejectDraftAction
} from '@/app/dashboard/contacts/[id]/ai-actions';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export type DraftView = {
  id: string;
  channel: 'sms' | 'email';
  subject: string | null;
  body: string;
  status: 'draft' | 'blocked' | 'sent' | 'rejected';
  blockedMessage: string | null;
};
export type BriefView = {
  headline: string;
  facts: {
    id: string;
    claim: string;
    quote: string | null;
    strength: 'strong' | 'weak';
    status: 'applied' | 'suggested' | 'accepted' | 'dismissed';
  }[];
};

function DraftRow({
  contactId,
  draft,
  canWrite
}: {
  contactId: string;
  draft: DraftView;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = React.useState(draft.subject ?? '');
  const [body, setBody] = React.useState(draft.body);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const open = draft.status === 'draft' || draft.status === 'blocked';
  const act = (fn: () => Promise<{ ok: boolean; message?: string; note?: string }>) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? (r.note ?? null) : (r.message ?? 'Something went wrong.'));
      router.refresh();
    });
  return (
    <li className='rounded-lg border p-3'>
      <div className='mb-2 flex flex-wrap items-center gap-2'>
        <StatusBadge
          tone={
            draft.status === 'sent' ? 'success' : draft.status === 'blocked' ? 'warning' : 'neutral'
          }
        >
          {draft.status === 'draft'
            ? 'Draft, not sent'
            : draft.status === 'blocked'
              ? 'Not sent: blocked'
              : draft.status === 'sent'
                ? 'Sent'
                : 'Discarded'}
        </StatusBadge>
        <span className='text-muted-foreground text-xs'>
          {draft.channel === 'sms' ? 'Text' : 'Email'}, written by AI
        </span>
      </div>
      {open && canWrite ? (
        <div className='flex flex-col gap-2'>
          {draft.channel === 'email' && (
            <Input
              aria-label='Subject'
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          )}
          <Textarea
            aria-label='Message'
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className='text-muted-foreground text-xs'>
            Read it and fix anything wrong. It only goes out when you approve it, and only if this
            person can be contacted.
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button
              disabled={pending || !body.trim()}
              onClick={() => act(() => approveDraftAction(contactId, draft.id, subject, body))}
            >
              Approve and send
            </Button>
            {draft.status === 'draft' && (
              <Button
                variant='outline'
                disabled={pending}
                onClick={() => act(() => rejectDraftAction(contactId, draft.id))}
              >
                Discard
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className='text-sm whitespace-pre-wrap'>{draft.body}</p>
      )}
      {draft.status === 'blocked' && draft.blockedMessage && (
        <p className='mt-2 text-sm'>{draft.blockedMessage}</p>
      )}
      {message && (
        <p role='status' className='mt-2 text-sm'>
          {message}
        </p>
      )}
    </li>
  );
}

/** AI help on a contact: message drafts that wait for a person, and a research brief with its evidence. */
export function AiAssist({
  contactId,
  enabled,
  canWrite,
  drafts,
  brief
}: {
  contactId: string;
  enabled: boolean;
  canWrite: boolean;
  drafts: DraftView[];
  brief: BriefView | null;
}) {
  const router = useRouter();
  const [channel, setChannel] = React.useState<'sms' | 'email'>('sms');
  const [purpose, setPurpose] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; note?: string }>) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      if (!r.ok) setMessage(r.message ?? 'Something went wrong.');
      else setPurpose('');
      router.refresh();
    });
  const canAsk = enabled && canWrite;
  return (
    <div className='flex flex-col gap-6'>
      <section aria-labelledby='ai-drafts' className='flex flex-col gap-3'>
        <h3 id='ai-drafts' className='text-sm font-medium'>
          Message drafts
        </h3>
        {canAsk && (
          <form
            className='flex flex-col gap-2'
            onSubmit={(e) => {
              e.preventDefault();
              run(() => draftMessageAction(contactId, channel, purpose));
            }}
          >
            <label className='grid gap-1 text-sm'>
              Channel
              <select
                className='min-h-11 rounded border px-3'
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'sms' | 'email')}
              >
                <option value='sms'>Text</option>
                <option value='email'>Email</option>
              </select>
            </label>
            <div className='grid gap-1 text-sm'>
              <label htmlFor='ai-purpose'>What is the message for?</label>
              <Input
                id='ai-purpose'
                value={purpose}
                maxLength={300}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder='Follow up on the estimate'
              />
            </div>
            <div>
              <Button type='submit' disabled={pending || purpose.trim().length < 3}>
                {pending ? 'Writing a draft…' : 'Write a draft'}
              </Button>
            </div>
          </form>
        )}
        {message && (
          <p role='alert' className='text-sm'>
            {message}
          </p>
        )}
        {drafts.length === 0 ? (
          <p className='text-muted-foreground text-sm'>No drafts yet.</p>
        ) : (
          <ul className='flex flex-col gap-2'>
            {drafts.map((d) => (
              <DraftRow key={d.id} contactId={contactId} draft={d} canWrite={canWrite} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby='ai-brief' className='flex flex-col gap-3'>
        <h3 id='ai-brief' className='text-sm font-medium'>
          Research brief
        </h3>
        {canAsk && (
          <div>
            <Button
              variant='outline'
              disabled={pending}
              onClick={() => run(() => createBriefAction(contactId))}
            >
              {brief ? 'Refresh the brief' : 'Write a brief'}
            </Button>
          </div>
        )}
        {brief ? (
          <div className='flex flex-col gap-2'>
            <p className='text-sm'>{brief.headline}</p>
            <ul className='flex flex-col gap-2'>
              {brief.facts
                .filter((f) => f.status !== 'dismissed')
                .map((f) => (
                  <li key={f.id} className='rounded-lg border p-3 text-sm'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <span>{f.claim}</span>
                      <StatusBadge tone={f.status === 'suggested' ? 'warning' : 'success'}>
                        {f.status === 'suggested'
                          ? 'Suggestion: not confirmed'
                          : f.status === 'accepted'
                            ? 'Accepted'
                            : 'Found in the record'}
                      </StatusBadge>
                    </div>
                    {f.quote && <p className='text-muted-foreground mt-1 text-xs'>“{f.quote}”</p>}
                    {f.status === 'suggested' && canWrite && (
                      <div className='mt-2 flex gap-2'>
                        <Button
                          size='sm'
                          disabled={pending}
                          onClick={() => run(() => decideFactAction(contactId, f.id, 'accepted'))}
                        >
                          Accept
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={pending}
                          onClick={() => run(() => decideFactAction(contactId, f.id, 'dismissed'))}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>No brief yet.</p>
        )}
      </section>
    </div>
  );
}
