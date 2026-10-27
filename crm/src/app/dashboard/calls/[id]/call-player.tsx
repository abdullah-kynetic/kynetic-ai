'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { recordingUrlAction } from './actions';
import { CALL_SEEK_EVENT, CALL_TIME_EVENT } from './transcript';

const RATES = [1, 1.5, 2] as const;

/** The signed URL lives five minutes, so it is fetched on load and again if playback fails. */
export function CallPlayer({ callId, hasRecording }: { callId: string; hasRecording: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasRecording);
  const [failed, setFailed] = useState(false);
  const [rate, setRate] = useState<(typeof RATES)[number]>(1);

  const load = useCallback(async () => {
    const r = await recordingUrlAction(callId);
    setFailed(!r.ok);
    if (r.ok) setUrl(r.url);
    setLoading(false);
  }, [callId]);

  const retry = () => {
    setLoading(true);
    void load();
  };

  useEffect(() => {
    if (!hasRecording) return;
    let live = true;
    void recordingUrlAction(callId).then((r) => {
      if (!live) return;
      setFailed(!r.ok);
      if (r.ok) setUrl(r.url);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [hasRecording, callId]);

  useEffect(() => {
    const seek = (e: Event) => {
      const el = audio.current;
      if (!el) return;
      el.currentTime = (e as CustomEvent<number>).detail;
      void el.play();
    };
    window.addEventListener(CALL_SEEK_EVENT, seek);
    return () => window.removeEventListener(CALL_SEEK_EVENT, seek);
  }, []);

  const changeRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recording</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRecording ? (
          <p className='text-muted-foreground text-sm'>No recording for this call.</p>
        ) : loading ? (
          <Skeleton className='h-10 w-full' />
        ) : failed || !url ? (
          <div role='alert' className='flex flex-wrap items-center gap-3 text-sm'>
            <span>Recording unavailable. The transcript below is still shown.</span>
            <Button variant='outline' size='sm' onClick={retry}>
              Try again
            </Button>
          </div>
        ) : (
          <div className='flex flex-wrap items-center gap-3'>
            {/* The full transcript below is the text alternative; the provider sends no caption file. */}
            {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              ref={audio}
              controls
              preload='metadata'
              src={url}
              aria-label='Call recording'
              className='min-w-0 flex-1'
              onTimeUpdate={(e) =>
                window.dispatchEvent(
                  new CustomEvent(CALL_TIME_EVENT, { detail: e.currentTarget.currentTime })
                )
              }
              onError={() => void load()}
            />
            <Button
              variant='outline'
              size='sm'
              onClick={changeRate}
              aria-label={`Playback speed ${rate}x. Change speed`}
            >
              {rate}x
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
