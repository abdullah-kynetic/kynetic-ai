import CallsView from "@/components/views/CallsView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallsView clientId={Number(id)} />;
}
