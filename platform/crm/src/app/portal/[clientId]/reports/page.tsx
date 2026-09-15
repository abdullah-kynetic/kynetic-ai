import ReportsView from "@/components/views/ReportsView";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ReportsView clientId={Number(clientId)} />;
}
