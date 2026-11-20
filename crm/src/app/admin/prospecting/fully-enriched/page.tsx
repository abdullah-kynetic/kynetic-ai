import { StageList, type StageSearch } from '../stage-list';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: StageSearch }) {
  return <StageList stage='fully_enriched' search={searchParams} />;
}
