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
import { useState } from 'react';
import { moveSalesDealAction } from './actions';

export type SalesStage = { id: string; name: string };
export type SalesCard = { id: string; name: string; email: string | null; stageId: string };

const labels: Record<string, string> = {
  Contacted: 'Audit sent',
  Interested: 'Call booked',
  'Proposal Sent': 'Proposal',
  Nurture: 'Contract'
};
const order = ['New', 'Audit sent', 'Call booked', 'Proposal', 'Contract', 'Won', 'Lost'];

function Card({ card }: { card: SalesCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`bg-card rounded-lg border p-3 shadow-sm ${isDragging ? 'z-10 opacity-70' : ''}`}
    >
      <button
        type='button'
        className='w-full cursor-grab touch-none text-left focus-visible:ring-2 focus-visible:ring-ring'
        {...attributes}
        {...listeners}
      >
        <span className='block font-medium'>{card.name}</span>
        <span className='text-muted-foreground block break-all text-xs'>
          {card.email ?? 'No email'}
        </span>
        <span className='sr-only'>Drag to change sales stage</span>
      </button>
    </div>
  );
}

function Column({ stage, cards }: { stage: SalesStage; cards: SalesCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name} stage`}
      className={`bg-surface-sunken min-h-48 w-64 shrink-0 space-y-3 rounded-xl border p-3 ${isOver ? 'ring-primary ring-2' : ''}`}
    >
      <div className='flex justify-between gap-2'>
        <h2 className='font-semibold'>{stage.name}</h2>
        <span className='text-muted-foreground text-sm'>{cards.length}</span>
      </div>
      {cards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
      {cards.length === 0 && <p className='text-muted-foreground text-xs'>Drop a deal here.</p>}
    </section>
  );
}

export function SalesBoard({
  stages,
  initialCards
}: {
  stages: SalesStage[];
  initialCards: SalesCard[];
}) {
  const [cards, setCards] = useState(initialCards);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ordered = [...stages]
    .map((stage) => ({ ...stage, name: labels[stage.name] ?? stage.name }))
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  async function onDragEnd(event: DragEndEvent) {
    const dealId = String(event.active.id);
    const stageId = event.over ? String(event.over.id) : '';
    const current = cards.find((card) => card.id === dealId);
    if (!current || !stageId || stageId === current.stageId) return;
    const target = ordered.find((stage) => stage.id === stageId);
    const lostReason =
      target?.name === 'Lost' ? window.prompt('Why was this deal lost?') : undefined;
    if (target?.name === 'Lost' && !lostReason?.trim()) return;
    setError(null);
    setCards((all) => all.map((card) => (card.id === dealId ? { ...card, stageId } : card)));
    try {
      const result = await moveSalesDealAction(dealId, stageId, lostReason?.trim());
      if (result.ok) return;
      setError(result.message);
    } catch {
      setError('Check your connection and try again.');
    }
    setCards((all) =>
      all.map((card) => (card.id === dealId ? { ...card, stageId: current.stageId } : card))
    );
  }

  return (
    <div className='space-y-4'>
      {error && (
        <div
          role='alert'
          className='border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm'
        >
          Deal stage was not saved. {error}
        </div>
      )}
      <p className='text-muted-foreground text-sm'>
        Drag a card to another stage. Changes are saved to the synthetic agency workspace.
      </p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className='flex gap-4 overflow-x-auto pb-4' aria-label='Sales pipeline board'>
          {ordered.map((stage) => (
            <Column
              key={stage.id}
              stage={stage}
              cards={cards.filter((card) => card.stageId === stage.id)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
