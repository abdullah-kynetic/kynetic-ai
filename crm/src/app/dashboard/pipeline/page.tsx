import PageContainer from '@/components/layout/page-container';
import { EmptyState } from '@/components/ui/states';
import { KanbanBoardView } from '@/features/pipeline/board/kanban-board';
import { BoardFilterBar } from '@/features/pipeline/board/board-filters';
import { readBoardFilters, type RawSearchParams } from '@/features/pipeline/board/search-params';
import { getBoardView, dealsScope } from '@/server/deals';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pipeline' };

// Kanban board (M2-02, PRD F-16). Base portal: platform, not behind the crm module (PRD decision 1).
export default async function PipelinePage({
  searchParams
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const requestHeaders = await headers();
  const ctx = await dealsScope(requestHeaders);
  if (!ctx) {
    return (
      <PageContainer pageTitle='Pipeline' access={false}>
        {null}
      </PageContainer>
    );
  }
  const filters = readBoardFilters(await searchParams);
  const [view, writeCtx] = await Promise.all([
    getBoardView(ctx, filters),
    dealsScope(requestHeaders, 'write')
  ]);
  const stages = view.columns.map((c) => c.stage);
  return (
    <PageContainer
      pageTitle='Pipeline'
      pageDescription='Drag a deal to move it between stages. Totals update as you go.'
    >
      <BoardFilterBar
        owners={view.filters.owners}
        sources={view.filters.sources}
        ownerId={filters.ownerId}
        source={filters.source}
      />
      {stages.length === 0 ? (
        <EmptyState
          title='No pipeline yet'
          description='Your pipeline is set up when your account is created. Contact Kynetic if it is missing.'
        />
      ) : (
        <KanbanBoardView
          canWrite={writeCtx !== null}
          data={{
            stages,
            deals: Object.fromEntries(view.columns.map((c) => [c.stage.id, c.deals])),
            contactNames: view.contactNames,
            overdueDealIds: view.overdueDealIds,
            owners: view.filters.owners
          }}
        />
      )}
    </PageContainer>
  );
}
