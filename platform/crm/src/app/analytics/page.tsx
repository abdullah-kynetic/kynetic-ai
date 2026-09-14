import { getLeads } from "@/lib/actions";
import AnalyticsCharts from "./AnalyticsCharts";

export const dynamic = "force-dynamic";


export default async function AnalyticsPage() {
  const leads = await getLeads();
  return <AnalyticsCharts leads={leads} />;
}
