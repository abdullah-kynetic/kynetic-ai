'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { useState } from 'react';

type StageRow = {
  id: string;
  name: string;
  position: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
  dealCount: number;
};

const API = '/api/settings/pipeline/stages';

/** Stage list with rename, move up and down (keyboard friendly, no drag needed), add and delete. */
export function StagesManager({ initial, canEdit }: { initial: StageRow[]; canEdit: boolean }) {
  const [stages, setStages] = useState(initial);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(url: string, init: RequestInit, done: string): Promise<boolean> {
    setBusy(true);
    setStatus(null);
    const res = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json' }
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      const fields = body.error?.fieldErrors as Record<string, string[]> | undefined;
      setStatus({
        ok: false,
        text: fields?.name?.includes('duplicate')
          ? 'Another stage already has that name.'
          : fields
            ? `Check these fields: ${Object.keys(fields).join(', ')}`
            : (body.error?.message ?? 'Could not save.')
      });
      return false;
    }
    setStages(body.stages);
    setNames({});
    setStatus({ ok: true, text: done });
    return true;
  }

  const rename = (s: StageRow) =>
    call(
      `${API}/${s.id}`,
      { method: 'PATCH', body: JSON.stringify({ name: names[s.id] }) },
      'Stage renamed.'
    );

  const move = (index: number, by: -1 | 1) => {
    const ids = stages.map((s) => s.id);
    [ids[index], ids[index + by]] = [ids[index + by]!, ids[index]!];
    return call(
      `${API}/order`,
      { method: 'PUT', body: JSON.stringify({ stageIds: ids }) },
      'Order saved.'
    );
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (
      await call(API, { method: 'POST', body: JSON.stringify({ name: newName }) }, 'Stage added.')
    ) {
      setNewName('');
    }
  }

  async function remove(s: StageRow) {
    const query = s.dealCount > 0 ? `?moveTo=${encodeURIComponent(moveTo)}` : '';
    if (await call(`${API}/${s.id}${query}`, { method: 'DELETE' }, 'Stage deleted.')) {
      setDeleting(null);
      setMoveTo('');
    }
  }

  return (
    <div className='max-w-2xl space-y-6'>
      <ol className='space-y-3' aria-label='Pipeline stages in board order'>
        {stages.map((s, i) => {
          const draft = names[s.id] ?? s.name;
          const outcome = s.isWon ? 'Won stage' : s.isLost ? 'Lost stage' : null;
          return (
            <li key={s.id} className='bg-card space-y-3 rounded-lg border p-3'>
              <div className='flex flex-wrap items-end gap-3'>
                <div className='min-w-48 flex-1 space-y-1'>
                  <Label htmlFor={`stage-${s.id}`}>
                    Stage {i + 1}
                    {outcome ? ` (${outcome})` : ''}
                  </Label>
                  <Input
                    id={`stage-${s.id}`}
                    value={draft}
                    maxLength={60}
                    disabled={!canEdit || busy}
                    onChange={(e) => setNames((n) => ({ ...n, [s.id]: e.target.value }))}
                  />
                </div>
                <span className='text-muted-foreground pb-3 text-sm'>
                  {s.dealCount} {s.dealCount === 1 ? 'deal' : 'deals'}
                </span>
                {canEdit && (
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      variant='secondary'
                      disabled={busy || draft.trim() === '' || draft.trim() === s.name}
                      onClick={() => rename(s)}
                    >
                      Save name
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      aria-label={`Move ${s.name} up`}
                      disabled={busy || i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <IconArrowUp />
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      size='icon'
                      aria-label={`Move ${s.name} down`}
                      disabled={busy || i === stages.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <IconArrowDown />
                    </Button>
                    {!s.isWon && !s.isLost && (
                      <Button
                        type='button'
                        variant='destructive'
                        disabled={busy}
                        onClick={() => {
                          setDeleting(deleting === s.id ? null : s.id);
                          setMoveTo('');
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {deleting === s.id && (
                <div
                  className='space-y-2 border-t pt-3'
                  role='group'
                  aria-label={`Delete ${s.name}`}
                >
                  {s.dealCount > 0 ? (
                    <>
                      <Label htmlFor={`move-${s.id}`}>
                        Move its {s.dealCount} {s.dealCount === 1 ? 'deal' : 'deals'} to
                      </Label>
                      <select
                        id={`move-${s.id}`}
                        className='border-input bg-background h-10 w-full rounded-md border px-2 text-sm'
                        value={moveTo}
                        onChange={(e) => setMoveTo(e.target.value)}
                      >
                        <option value=''>Choose a stage</option>
                        {stages
                          .filter((o) => o.id !== s.id && !o.isWon && !o.isLost)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>
                    </>
                  ) : (
                    <p className='text-sm'>This stage has no deals. Delete it?</p>
                  )}
                  <div className='flex gap-2'>
                    <Button
                      type='button'
                      variant='destructive-solid'
                      disabled={busy || (s.dealCount > 0 && moveTo === '')}
                      onClick={() => remove(s)}
                    >
                      Delete stage
                    </Button>
                    <Button type='button' variant='secondary' onClick={() => setDeleting(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {canEdit ? (
        <form onSubmit={add} className='flex flex-wrap items-end gap-3'>
          <div className='min-w-48 flex-1 space-y-1'>
            <Label htmlFor='new-stage'>New stage</Label>
            <Input
              id='new-stage'
              value={newName}
              maxLength={60}
              disabled={busy}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <Button type='submit' disabled={busy || newName.trim() === ''}>
            Add stage
          </Button>
        </form>
      ) : (
        <p className='text-muted-foreground text-sm'>Only the owner can change the stages.</p>
      )}

      <p role='status' className={status?.ok === false ? 'text-destructive text-sm' : 'text-sm'}>
        {status?.text}
      </p>
    </div>
  );
}
