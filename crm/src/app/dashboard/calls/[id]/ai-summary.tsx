'use client';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { summarizeCallAction } from './actions';

const TAG: Record<string, string> = {
  booked: 'Booked',
  qualified: 'Qualified',
  not_interested: 'Not interested',
  voicemail: 'Voicemail',
  no_answer: 'No answer',
  transferred: 'Transferred',
  callback_requested: 'Callback requested',
  wrong_number: 'Wrong number',
  asked_to_stop: 'Asked to stop',
  other: 'Other'
};

/** An AI summary and outcome label for the call. A label only: it never changes who can be contacted. */
export function AiSummary({
  callId,
  enabled,
  hasTranscript,
  summary
}: {
  callId: string;
  enabled: boolean;
  hasTranscript: boolean;
  summary: { summary: string; outcomeTag: string } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      setError(null);
      const r = await summarizeCallAction(callId);
      if (!r.ok) setError(r.message);
      router.refresh();
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI summary</CardTitle>
        <CardDescription>
          Written by AI from the transcript. Check it against the call.
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-3'>
        {summary ? (
          <>
            <div>
              <StatusBadge tone={summary.outcomeTag === 'asked_to_stop' ? 'warning' : 'info'}>
                {TAG[summary.outcomeTag] ?? 'Other'}
              </StatusBadge>
            </div>
            <p className='text-sm'>{summary.summary}</p>
            {summary.outcomeTag === 'asked_to_stop' && (
              <p className='text-sm'>
                This is only a label. If the caller asked to stop, a person has to record the
                opt-out.
              </p>
            )}
          </>
        ) : (
          <p className='text-muted-foreground text-sm'>No AI summary yet.</p>
        )}
        {enabled && hasTranscript && (
          <div>
            <Button variant='outline' disabled={pending} onClick={run}>
              {pending ? 'Summarizing…' : summary ? 'Summarize again' : 'Summarize with AI'}
            </Button>
          </div>
        )}
        {error && (
          <p role='alert' className='text-sm'>
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
