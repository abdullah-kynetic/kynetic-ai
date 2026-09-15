import CallsView from "@/components/views/CallsView";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <CallsView clientId={Number(clientId)} />;
}
