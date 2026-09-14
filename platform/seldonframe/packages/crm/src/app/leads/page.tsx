import { getLeads } from "@/lib/actions";
import LeadsView from "./LeadsView";

export const dynamic = "force-dynamic";


export default async function LeadsPage() {
  const leads = await getLeads();
  return <LeadsView leads={leads} />;
}
