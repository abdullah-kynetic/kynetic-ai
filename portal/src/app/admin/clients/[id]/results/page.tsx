import { loadDetail } from "../load";
import { ResultsView } from "@/components/portal/results-view";

export const dynamic = "force-dynamic";

export default async function ResultsTab({ params }: PageProps<"/admin/clients/[id]/results">) {
  const { id } = await params;
  const { results } = await loadDetail(id);
  return <ResultsView data={results} />;
}
