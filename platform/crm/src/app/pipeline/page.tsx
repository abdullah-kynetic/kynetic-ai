import { getLeads } from "@/lib/actions";
import PipelineBoard from "./PipelineBoard";

export const dynamic = "force-dynamic";


export default async function PipelinePage() {
  const leads = await getLeads();
  return <PipelineBoard leads={leads} />;
}
