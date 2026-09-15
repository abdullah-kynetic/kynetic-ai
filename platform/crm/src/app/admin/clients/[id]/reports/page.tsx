import ReportsView from "@/components/views/ReportsView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportsView clientId={Number(id)} />;
}
