'use client';

import { IconChevronDown, IconChevronRight, IconDots, IconGripVertical } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { moveDealAction } from '@/app/dashboard/pipeline/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge, StatusBadge, type StatusTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay
} from '@/components/ui/kanban';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { formatCents } from '@/server/deals/money';
import type { BoardDeal, Stage } from '@/server/deals/pipelines';
import {
  columnStats,
  locate,
  moveCard,
  sameSpot,
  spotOf,
  type Columns,
  type Spot
} from './board-state';

export type BoardData = {
  stages: Stage[];
  deals: Record<string, BoardDeal[]>;
  contactNames: Record<string, string>;
  overdueDealIds: string[];
  owners: { id: string; name: string }[];
};

const stageTone = (s: Stage): StatusTone => (s.isWon ? 'success' : s.isLost ? 'neutral' : 'info');
const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  neutral: 'bg-muted-foreground',
  warning: 'bg-warning',
  error: 'bg-destructive'
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

type Pending = { dealId: string; from: Spot; to: Spot; title: string; stageName: string };

/**
 * The kanban board (F-16). The browser owns the optimistic order; the server action persists each
 * move, and a rejected move rolls just that card back with an error toast. Moves are sent one at a
 * time, in the order they were made. Undo sends the opposite move.
 */
export function KanbanBoardView({ data, canWrite }: { data: BoardData; canWrite: boolean }) {
  const router = useRouter();
  const [source, setSource] = React.useState(data);
  const [cols, setCols] = React.useState<Columns>(data.deals);
  // Fresh server data (filters changed, or a refresh after a failure) replaces the local order.
  if (source !== data) {
    setSource(data);
    setCols(data.deals);
  }
  const colsRef = React.useRef(cols);
  const apply = React.useCallback((next: Columns) => {
    colsRef.current = next;
    setCols(next);
  }, []);
  React.useEffect(() => {
    colsRef.current = cols;
  });

  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = React.useState('');
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [reason, setReason] = React.useState('');
  const requestMoveRef = React.useRef<(id: string, to: Spot, isUndo?: boolean) => void>(null);
  const dragStart = React.useRef<Columns | null>(null);
  const queue = React.useRef<Promise<unknown>>(Promise.resolve());

  const stageById = React.useMemo(() => new Map(data.stages.map((s) => [s.id, s])), [data.stages]);
  const ownerName = React.useMemo(
    () => new Map(data.owners.map((o) => [o.id, o.name])),
    [data.owners]
  );
  const overdue = React.useMemo(() => new Set(data.overdueDealIds), [data.overdueDealIds]);
  const dealById = React.useCallback(
    (id: string) =>
      Object.values(colsRef.current)
        .flat()
        .find((d) => d.id === id),
    []
  );

  /** Sends one move. `isUndo` swaps the Undo toast for a plain confirmation. */
  const persist = React.useCallback(
    (dealId: string, title: string, from: Spot, to: Spot, lostReason?: string, isUndo = false) => {
      const stageName = stageById.get(to.stageId)?.name ?? 'the new stage';
      queue.current = queue.current.then(async () => {
        const result = await moveDealAction(dealId, {
          stageId: to.stageId,
          afterDealId: to.afterDealId,
          ...(lostReason ? { lostReason } : {})
        });
        if (!result.ok) {
          // Roll back this card only; other moves may be in flight.
          apply(moveCard(colsRef.current, dealId, from.stageId, from.afterDealId));
          notify.error(`Could not move "${title}". ${result.message}`);
          setAnnouncement(`Could not move ${title}. It is back where it was.`);
          router.refresh();
          return;
        }
        if (isUndo) {
          notify.success(`Move undone. "${title}" is back in ${stageById.get(to.stageId)?.name}.`);
          return;
        }
        notify.success(`Moved "${title}" to ${stageName}.`, {
          action: {
            label: 'Undo',
            onClick: () => requestMoveRef.current?.(dealId, from, true)
          }
        });
      });
    },
    [apply, router, stageById]
  );

  /** Commits a finished move: asks for a reason first when it lands in a Lost stage (F-14). */
  const commit = React.useCallback(
    (dealId: string, from: Spot, to: Spot, isUndo = false) => {
      const deal = dealById(dealId);
      if (!deal) return;
      const target = stageById.get(to.stageId);
      if (target?.isLost && from.stageId !== to.stageId) {
        setReason('');
        setPending({ dealId, from, to, title: deal.title, stageName: target.name });
        return;
      }
      setAnnouncement(announce(colsRef.current, dealId, deal.title, target?.name));
      persist(dealId, deal.title, from, to, undefined, isUndo);
    },
    [dealById, persist, stageById]
  );

  /** Moves a card to a spot (menu, undo): updates the board now, then persists. */
  const requestMove = React.useCallback(
    (dealId: string, to: Spot | { stageId: string; afterDealId?: undefined }, isUndo = false) => {
      const before = colsRef.current;
      const from = spotOf(before, dealId);
      if (!from) return;
      const next = moveCard(before, dealId, to.stageId, to.afterDealId);
      const placed = spotOf(next, dealId);
      if (!placed || sameSpot(from, placed)) return;
      apply(next);
      commit(dealId, from, placed, isUndo);
    },
    [apply, commit]
  );
  React.useEffect(() => {
    requestMoveRef.current = requestMove;
  }, [requestMove]);

  const finishDrag = (activeId: string, hadTarget: boolean) => {
    const snapshot = dragStart.current;
    dragStart.current = null;
    if (!snapshot) return;
    if (!hadTarget) {
      apply(snapshot);
      return;
    }
    // The kanban applies a same-column reorder after this callback, so read the result next tick.
    queueMicrotask(() => {
      const from = spotOf(snapshot, activeId);
      const to = spotOf(colsRef.current, activeId);
      if (from && to && !sameSpot(from, to)) commit(activeId, from, to);
    });
  };

  const cancelLost = () => {
    if (!pending) return;
    // Put the card back: the move never reached the server.
    apply(
      moveCard(colsRef.current, pending.dealId, pending.from.stageId, pending.from.afterDealId)
    );
    setPending(null);
  };
  const confirmLost = () => {
    if (!pending || !reason.trim()) return;
    const p = pending;
    setPending(null);
    setAnnouncement(announce(colsRef.current, p.dealId, p.title, p.stageName));
    persist(p.dealId, p.title, p.from, p.to, reason.trim());
  };

  const toggle = (stageId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(stageId)) next.add(stageId);
      return next;
    });

  if (data.stages.length === 0) return null;

  return (
    <>
      <div role='status' aria-live='polite' className='sr-only'>
        {announcement}
      </div>
      <Kanban
        value={cols}
        onValueChange={apply}
        getItemValue={(d: BoardDeal) => d.id}
        onDragStart={() => {
          dragStart.current = colsRef.current;
        }}
        onDragEnd={(e) => finishDrag(String(e.active.id), e.over !== null)}
        onDragCancel={(e) => finishDrag(String(e.active.id), false)}
      >
        <KanbanBoard
          className='min-h-0 flex-1 snap-x snap-mandatory items-start overflow-x-auto pb-3'
          aria-label='Pipeline stages'
        >
          {data.stages.map((stage) => {
            const deals = cols[stage.id] ?? [];
            const { count, totalCents } = columnStats(deals);
            const tone = stageTone(stage);
            const isCollapsed = collapsed.has(stage.id);
            const collapsible = stage.isWon || stage.isLost;
            return (
              <KanbanColumn
                key={stage.id}
                value={stage.id}
                aria-label={stage.name}
                className={cn(
                  'h-fit max-h-full w-72 shrink-0 snap-start md:w-72',
                  isCollapsed && 'w-44'
                )}
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span
                        aria-hidden='true'
                        className={cn('size-2.5 shrink-0 rounded-full', TONE_DOT[tone])}
                      />
                      <h2 className='truncate text-sm font-semibold'>{stage.name}</h2>
                      <Badge variant='outline' className='tabular-nums'>
                        {count}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground mt-0.5 text-xs tabular-nums'>
                      {formatCents(totalCents)}
                    </p>
                  </div>
                  {collapsible ? (
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${stage.name}`}
                      onClick={() => toggle(stage.id)}
                    >
                      {isCollapsed ? <IconChevronRight /> : <IconChevronDown />}
                    </Button>
                  ) : null}
                </div>
                <div
                  className={cn('flex min-h-12 flex-col gap-2', isCollapsed && 'hidden')}
                  data-testid={`stage-${stage.name}`}
                >
                  {deals.map((deal) => (
                    <KanbanItem key={deal.id} value={deal.id} disabled={!canWrite}>
                      <DealCard
                        deal={deal}
                        stages={data.stages}
                        contactName={data.contactNames[deal.id]}
                        ownerName={deal.ownerId ? ownerName.get(deal.ownerId) : undefined}
                        isOverdue={overdue.has(deal.id)}
                        canWrite={canWrite}
                        onMove={(stageId) => requestMove(deal.id, { stageId })}
                      />
                    </KanbanItem>
                  ))}
                  {deals.length === 0 ? (
                    <p className='text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs'>
                      No deals here
                    </p>
                  ) : null}
                </div>
              </KanbanColumn>
            );
          })}
        </KanbanBoard>
        <KanbanOverlay>
          {({ value }) => {
            const deal = dealById(String(value));
            return deal ? (
              <DealCard
                deal={deal}
                stages={data.stages}
                contactName={data.contactNames[deal.id]}
                ownerName={deal.ownerId ? ownerName.get(deal.ownerId) : undefined}
                isOverdue={overdue.has(deal.id)}
                canWrite={false}
                onMove={() => {}}
              />
            ) : null;
          }}
        </KanbanOverlay>
      </Kanban>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && cancelLost()}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Why was this deal lost?</DialogTitle>
            <DialogDescription>
              {pending ? `"${pending.title}" is moving to ${pending.stageName}. ` : ''}
              A short reason is required so reports can show why jobs are lost.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label='Lost reason'
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            placeholder='For example: chose a cheaper quote'
          />
          <DialogFooter>
            <Button type='button' variant='outline' onClick={cancelLost}>
              Cancel
            </Button>
            <Button type='button' disabled={!reason.trim()} onClick={confirmLost}>
              Move to {pending?.stageName}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function announce(cols: Columns, dealId: string, title: string, stageName?: string) {
  const at = locate(cols, dealId);
  if (!at) return '';
  return `Moved ${title} to ${stageName ?? 'the new stage'}, position ${at.index + 1} of ${cols[at.stageId]!.length}`;
}

function DealCard({
  deal,
  stages,
  contactName,
  ownerName,
  isOverdue,
  canWrite,
  onMove
}: {
  deal: BoardDeal;
  stages: Stage[];
  contactName?: string;
  ownerName?: string;
  isOverdue: boolean;
  canWrite: boolean;
  onMove: (stageId: string) => void;
}) {
  return (
    <article
      aria-label={deal.title}
      className='bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-xs'
    >
      <div className='flex items-start justify-between gap-1'>
        <div className='min-w-0'>
          <h3 className='truncate text-sm font-medium'>{deal.title}</h3>
          {contactName ? (
            <p className='text-muted-foreground truncate text-xs'>{contactName}</p>
          ) : null}
        </div>
        {canWrite ? (
          <div className='-mt-1 -mr-1 flex shrink-0 items-center'>
            <KanbanItemHandle
              aria-label={`Drag ${deal.title}. Space to lift, arrow keys to move, Space to drop, Escape to cancel.`}
              className='text-muted-foreground hover:bg-accent hidden size-8 items-center justify-center rounded-md md:inline-flex'
            >
              <IconGripVertical className='size-4' aria-hidden='true' />
            </KanbanItemHandle>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label={`Move ${deal.title} to stage`}
                  />
                }
              >
                <IconDots />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-auto'>
                <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
                {stages
                  .filter((s) => s.id !== deal.stageId)
                  .map((s) => (
                    <DropdownMenuItem key={s.id} onClick={() => onMove(s.id)}>
                      {s.name}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>
      <div className='flex flex-wrap items-center gap-1.5'>
        <span className='text-sm font-semibold tabular-nums'>{formatCents(deal.valueCents)}</span>
        {deal.source ? <Badge variant='outline'>{deal.source}</Badge> : null}
        {isOverdue ? (
          <StatusBadge tone='error'>
            <span className='sr-only'>Has an </span>Overdue task
          </StatusBadge>
        ) : null}
        {ownerName ? (
          <Avatar size='sm' className='ms-auto' title={ownerName}>
            <AvatarFallback aria-label={`Owner: ${ownerName}`}>
              {initials(ownerName)}
            </AvatarFallback>
          </Avatar>
        ) : null}
      </div>
    </article>
  );
}
