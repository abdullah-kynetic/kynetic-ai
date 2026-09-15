import DashboardView from "@/components/views/DashboardView";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <DashboardView clientId={Number(clientId)} />;
}
