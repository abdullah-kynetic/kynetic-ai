import FollowUpsView from "@/components/views/FollowUpsView";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <FollowUpsView clientId={Number(clientId)} />;
}
