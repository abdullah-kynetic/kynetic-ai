'use client';

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Icons } from '@/components/icons';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { movePipelineCardAction } from './actions';

type Column = 'audit_pending' | 'proposal' | 'building' | 'testing' | 'live';
type CardData = { kind: 'deal' | 'client'; id: string; column: Column; createHref?: string };

/** Wraps the pipeline columns. A drop is saved on the server, then the page is refreshed from it. */
export function PipelineDnd({
  children,
  canMove
}: {
  children: React.ReactNode;
  canMove: boolean;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(event: DragEndEvent) {
    const card = event.active.data.current as CardData | undefined;
    const to = event.over ? (String(event.over.id) as Column) : null;
    if (!card || !to || to === card.column) return;
    setError(null);
    const needsAccount = card.kind === 'deal' && ['building', 'testing', 'live'].includes(to);
    if (needsAccount && card.createHref) {
      router.push(card.createHref);
      return;
    }
    try {
      const result = await movePipelineCardAction(card.kind, card.id, to);
      if (!result.ok) setError(result.message);
    } catch {
      setError('Check your connection and try again.');
    }
    router.refresh();
  }

  return (
    <div className='min-w-0 space-y-3'>
      {error && (
        <div
          role='alert'
          className='border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm'
        >
          Not saved. {error}
        </div>
      )}
      <p className='text-muted-foreground text-sm'>
        {canMove
          ? 'Drag a card to another stage. Each move is saved. A deal dragged to Building opens the client account form first.'
          : 'Only a Kynetic admin can move cards.'}
      </p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {children}
      </DndContext>
    </div>
  );
}

export function PipelineColumn({
  column,
  label,
  count,
  children
}: {
  column: Column;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label} stage`}
      className={`bg-secondary/40 flex min-h-48 min-w-[82%] shrink-0 snap-start flex-col gap-2 rounded-xl md:min-w-0 md:shrink border p-3 ${isOver ? 'ring-primary ring-2' : ''}`}
    >
      <div className='flex items-center justify-between'>
        <h2 className='font-medium'>{label}</h2>
        <span className='ticket-meta'>{count}</span>
      </div>
      {children}
    </section>
  );
}

/** A draggable card. Only the grip is the drag handle, so buttons and inputs inside keep working. */
export function PipelineCard({
  data,
  name,
  canMove,
  children
}: {
  data: CardData;
  name: string;
  canMove: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${data.kind}:${data.id}`,
    data,
    disabled: !canMove
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`bg-card relative grid gap-2 rounded-lg border p-3 ${canMove ? 'pr-10' : ''} ${isDragging ? 'z-10 opacity-70 shadow-md' : ''}`}
    >
      {canMove && (
        <button
          type='button'
          aria-label={`Drag ${name} to another stage`}
          className='text-muted-foreground hover:bg-secondary absolute top-1.5 right-1.5 flex size-8 cursor-grab touch-none items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring'
          {...attributes}
          {...listeners}
        >
          <Icons.gripVertical aria-hidden className='size-4' />
        </button>
      )}
      {children}
    </div>
  );
}
