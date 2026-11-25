import { headers } from 'next/headers';
import { DisabledAction } from '@/components/shop/disabled-action';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { Badge } from '@/components/ui/badge';
import { KanbanBoardView } from '@/features/pipeline/board/kanban-board';
import { dealsScope } from '@/server/deals';
import type { BoardDeal } from '@/server/deals/pipelines';
import { getJobsBoard, type JobCard } from '@/server/shop';
import { money } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

function CarDetails({ job }: { job: JobCard }) {
  const bits = [
    job.paymentType === 'insurance'
      ? job.insurer
        ? `Insurance · ${job.insurer}`
        : 'Insurance'
      : job.paymentType === 'out_of_pocket'
        ? 'Out-of-pocket'
        : null
  ].filter(Boolean);
  return (
    <div className='flex flex-col gap-1.5' data-testid='car-details'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <span className='text-sm font-medium tabular-nums'>{money(job.amountCents)}</span>
        {bits.map((b) => (
          <Badge key={b} variant='outline'>
            {b}
          </Badge>
        ))}
      </div>
      <p className='text-muted-foreground text-xs'>
        {job.daysInShop === 1 ? '1 day' : `${job.daysInShop} days`} in shop
        {job.tech ? ` · Tech: ${job.tech}` : ''}
      </p>
    </div>
  );
}

export default async function JobsPage() {
  const ctx = await shopContext();
  const [{ stages }, writeCtx] = await Promise.all([
    getJobsBoard(ctx),
    dealsScope(await headers(), 'write')
  ]);
  const jobs = stages.flatMap((s) => s.jobs);
  const deals: Record<string, BoardDeal[]> = {};
  const contactNames: Record<string, string> = {};
  const bodies: Record<string, React.ReactNode> = {};
  for (const s of stages) {
    deals[s.id] = s.jobs.map((j, i) => {
      if (j.customerName) contactNames[j.id] = j.customerName;
      bodies[j.id] = <CarDetails job={j} />;
      return {
        id: j.id,
        title: j.vehicleLabel || j.title,
        valueCents: j.amountCents,
        serviceType: null,
        expectedClose: null,
        ownerId: j.ownerId,
        source: null,
        stageId: s.id,
        position: String(i).padStart(6, '0'),
        createdAt: j.createdAt
      };
    });
  }
  return (
    <ShopPage
      ctx={ctx}
      title='Jobs board'
      description='Every car in the shop, from new lead to picked up. Drag a car, or use its menu, to move it.'
      actions={
        <DisabledAction id='status-text' note='Turns on when this is connected'>
          Text customer on every move
        </DisabledAction>
      }
    >
      {jobs.length === 0 ? (
        <ShopEmpty
          title='No jobs yet'
          description='Jobs will appear here as cars move through the shop.'
        />
      ) : (
        <>
          <p className='text-muted-foreground text-sm' data-testid='status-text-preview'>
            Status text sent (demo): when this is connected, the customer would get a short text
            each time their car moves. Today a move only updates the board.
          </p>
          <KanbanBoardView
            canWrite={writeCtx !== null}
            data={{
              stages: stages.map((s) => ({
                id: s.id,
                name: s.name,
                isWon: s.isWon,
                isLost: s.isLost
              })),
              deals,
              contactNames,
              overdueDealIds: [],
              owners: [],
              bodies
            }}
          />
        </>
      )}
    </ShopPage>
  );
}
