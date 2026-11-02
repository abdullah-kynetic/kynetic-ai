'use client';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveProposalAction } from '../actions';
const sections = [
  { key: 'problem', title: 'Problem' },
  { key: 'solution', title: 'Agentic Solution' },
  { key: 'roadmap', title: 'Roadmap' },
  { key: 'roi', title: 'ROI' }
] as const;
type DraftContent = {
  id: string;
  revision: number;
  title: string;
  problem: string;
  solution: string;
  roadmap: string;
  roi: string;
};
export function ProposalEditor({ draft }: { draft: DraftContent }) {
  const [state, action, pending] = useActionState(saveProposalAction.bind(null, draft.id), {
    revision: draft.revision,
    ok: false,
    message: ''
  });
  const [content, setContent] = useState({
    title: draft.title,
    problem: draft.problem,
    solution: draft.solution,
    roadmap: draft.roadmap,
    roi: draft.roi
  });
  const update = (key: keyof typeof content, value: string) =>
    setContent((before) => ({ ...before, [key]: value }));
  return (
    <form action={action} className='max-w-3xl space-y-5'>
      <input type='hidden' name='expectedRevision' value={state.revision} />
      <div className='space-y-2'>
        <Label htmlFor='title'>Draft title</Label>
        <Input
          id='title'
          name='title'
          value={content.title}
          onChange={(event) => update('title', event.target.value)}
          disabled={pending}
          maxLength={200}
          required
        />
      </div>
      {sections.map((section) => (
        <div key={section.key} className='space-y-2'>
          <Label htmlFor={section.key}>{section.title}</Label>
          <textarea
            id={section.key}
            name={section.key}
            value={content[section.key]}
            onChange={(event) => update(section.key, event.target.value)}
            disabled={pending}
            maxLength={6000}
            rows={6}
            className='border-input bg-background w-full rounded border p-3'
            aria-describedby={section.key === 'roi' ? 'roi-help' : undefined}
          />
          {section.key === 'roi' && (
            <p id='roi-help' className='text-muted-foreground text-sm'>
              Record assumptions and estimated benefits for review. No ROI or guarantee is
              calculated automatically.
            </p>
          )}
        </div>
      ))}
      <Button type='submit' disabled={pending}>
        {pending ? 'Saving…' : 'Save draft'}
      </Button>
      {state.message && <p role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
    </form>
  );
}
