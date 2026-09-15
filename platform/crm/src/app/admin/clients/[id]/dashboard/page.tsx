import DashboardView from "@/components/views/DashboardView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DashboardView clientId={Number(id)} />;
}
