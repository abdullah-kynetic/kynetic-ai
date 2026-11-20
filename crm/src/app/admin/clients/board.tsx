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
import Link from 'next/link';
import { useState } from 'react';
import { moveClientStageAction } from './actions';

export type ClientStageId = 'onboarding' | 'live' | 'at_risk' | 'churned' | 'demo';
export type ClientCard = {
  id: string;
  name: string;
  plan: string;
  health: string;
  stage: ClientStageId;
  locked: boolean;
};

export const CLIENT_STAGES: { id: ClientStageId; name: string }[] = [
  { id: 'onboarding', name: 'Onboarding' },
  { id: 'live', name: 'Live' },
  { id: 'at_risk', name: 'At risk' },
  { id: 'churned', name: 'Churned' },
  { id: 'demo', name: 'Demo' }
];

function Card({ card, canMove }: { card: ClientCard; canMove: boolean }) {
  const disabled = !canMove || card.locked;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`bg-card rounded-lg border p-3 shadow-sm ${isDragging ? 'z-10 opacity-70' : ''}`}
    >
      <button
        type='button'
        className={`w-full touch-none text-left focus-visible:ring-2 focus-visible:ring-ring ${disabled ? '' : 'cursor-grab'}`}
        {...attributes}
        {...listeners}
      >
        <span className='block font-medium'>{card.name}</span>
        <span className='text-muted-foreground block text-xs'>
          {card.plan} · Health {card.health}
        </span>
        <span className='sr-only'>
          {disabled ? 'Locked, cannot change stage' : 'Drag to change client stage'}
        </span>
      </button>
      <Link
        href={`/admin/clients/${card.id}`}
        className='text-primary mt-2 inline-block text-xs underline-offset-4 hover:underline'
      >
        Open client
      </Link>
    </div>
  );
}

function Column({
  stage,
  cards,
  canMove
}: {
  stage: { id: ClientStageId; name: string };
  cards: ClientCard[];
  canMove: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name} stage`}
      className={`bg-surface-sunken min-h-48 w-64 shrink-0 space-y-3 rounded-xl border p-3 ${isOver ? 'ring-primary ring-2' : ''}`}
    >
      <div className='flex justify-between gap-2'>
        <h2 className='font-medium'>{stage.name}</h2>
        <span className='text-muted-foreground text-sm'>{cards.length}</span>
      </div>
      {cards.map((card) => (
        <Card key={card.id} card={card} canMove={canMove} />
      ))}
      {cards.length === 0 && <p className='text-muted-foreground text-xs'>No clients here.</p>}
    </section>
  );
}

export function ClientsBoard({
  initialCards,
  canMove
}: {
  initialCards: ClientCard[];
  canMove: boolean;
}) {
  const [cards, setCards] = useState(initialCards);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(event: DragEndEvent) {
    const id = String(event.active.id);
    const stage = event.over ? (String(event.over.id) as ClientStageId) : null;
    const current = cards.find((card) => card.id === id);
    if (!current || !stage || stage === current.stage || current.locked) return;
    setError(null);
    setCards((all) => all.map((card) => (card.id === id ? { ...card, stage } : card)));
    try {
      const result = await moveClientStageAction(id, stage);
      if (result.ok) return;
      setError(result.message);
    } catch {
      setError('Check your connection and try again.');
    }
    setCards((all) =>
      all.map((card) => (card.id === id ? { ...card, stage: current.stage } : card))
    );
  }

  return (
    <div className='min-w-0 space-y-4'>
      {error && (
        <div
          role='alert'
          className='border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm'
        >
          Client stage was not saved. {error}
        </div>
      )}
      <p className='text-muted-foreground text-sm'>
        {canMove
          ? 'Drag a client to another stage. Each move is saved and recorded in the audit log.'
          : 'Only a Kynetic admin can move clients between stages.'}
      </p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div
          className='relative flex gap-4 overflow-x-auto pb-4'
          aria-label='Client lifecycle board'
        >
          {CLIENT_STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              canMove={canMove}
              cards={cards.filter((card) => card.stage === stage.id)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
