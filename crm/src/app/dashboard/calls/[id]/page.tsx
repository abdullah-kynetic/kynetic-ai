import PageContainer from '@/components/layout/page-container';
import { StatusBadge, type StatusTone } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCallDetail } from '@/server/calls';
import { AppError } from '@/server/errors';
import { ForbiddenError, UnauthenticatedError } from '@/server/auth';
import { ModuleDisabledError } from '@/server/modules';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { CallPlayer } from './call-player';
import { callerForRequest } from './session';
import { FlagCall } from './flag-call';
import { Transcript } from './transcript';
import { AiSummary } from './ai-summary';
import { llmEnabled } from '@/server/adapters/llm';
import { getCallAiSummary } from '@/server/llm/features/call-summary';

export const metadata: Metadata = { title: 'Call', robots: { index: false } };
export const dynamic = 'force-dynamic';

const OUTCOME: Record<string, { label: string; tone: StatusTone }> = {
  booked: { label: 'Booked', tone: 'success' },
  qualified: { label: 'Qualified', tone: 'info' },
  not_interested: { label: 'Not interested', tone: 'neutral' },
  voicemail: { label: 'Voicemail', tone: 'neutral' },
  no_answer: { label: 'No answer', tone: 'neutral' },
  transferred: { label: 'Transferred', tone: 'info' },
  dnc: { label: 'Do not call', tone: 'error' },
  other: { label: 'Other', tone: 'neutral' }
};

const SENTIMENT: Record<string, StatusTone> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'warning',
  unknown: 'neutral'
};

function duration(s: number | null): string {
  if (s == null) return 'Duration unknown';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function label(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function show(value: unknown): string {
  if (value == null || value === '') return 'Not captured';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  let call;
  let aiSummary: Awaited<ReturnType<typeof getCallAiSummary>> = null;
  try {
    const caller = await callerForRequest();
    if (!caller) redirect('/dashboard');
    call = await getCallDetail(caller.actor, caller.ctx, id);
    aiSummary = await getCallAiSummary(caller.ctx, id);
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect('/sign-in');
    if (e instanceof AppError && e.code === 'NOT_FOUND') notFound();
    // The server is the gate (F-70): a refused call or a module that is off shows the access message.
    if (e instanceof ForbiddenError || e instanceof ModuleDisabledError) {
      return <PageContainer access={false}>{null}</PageContainer>;
    }
    throw e;
  }

  const outcome = call.outcome ? OUTCOME[call.outcome] : undefined;
  const started = new Date(call.startedAt);
  const extracted = Object.entries(call.extracted);

  return (
    <PageContainer
      pageTitle={call.contactName ?? 'Unknown caller'}
      pageDescription={`${call.direction === 'inbound' ? 'Inbound' : 'Alex'} call, ${duration(call.durationS)}`}
      pageHeaderAction={
        <FlagCall callId={call.id} flagged={call.flagged} flagNote={call.flagNote} />
      }
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <time dateTime={started.toISOString()} className='text-muted-foreground text-sm'>
            {started.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
          {outcome ? <StatusBadge tone={outcome.tone}>{outcome.label}</StatusBadge> : null}
          {call.sentiment ? (
            <StatusBadge tone={SENTIMENT[call.sentiment] ?? 'neutral'}>
              {label(call.sentiment)} sentiment
            </StatusBadge>
          ) : null}
          {call.disclosureGiven ? (
            <StatusBadge tone='info'>
              Recording disclosure given
              {call.disclosureVersion ? ` (${call.disclosureVersion})` : ''}
            </StatusBadge>
          ) : (
            <StatusBadge tone='warning'>No recording disclosure stored</StatusBadge>
          )}
        </div>

        <CallPlayer callId={call.id} hasRecording={call.hasRecording} />

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm'>{call.summary ?? 'No summary yet.'}</p>
          </CardContent>
        </Card>

        {(llmEnabled() || aiSummary) && (
          <AiSummary
            callId={call.id}
            enabled={llmEnabled()}
            hasTranscript={call.transcript !== null}
            summary={aiSummary}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>Extracted details</CardTitle>
          </CardHeader>
          <CardContent>
            {extracted.length === 0 ? (
              <p className='text-muted-foreground text-sm'>Alex did not capture any details.</p>
            ) : (
              <dl className='grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]'>
                {extracted.map(([k, v]) => (
                  <div key={k} className='contents'>
                    <dt className='text-muted-foreground'>{label(k)}</dt>
                    <dd>{show(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>

        <Transcript lines={call.transcript} />
      </div>
    </PageContainer>
  );
}
