import FollowUpsView from "@/components/views/FollowUpsView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FollowUpsView clientId={Number(id)} />;
}
