import ReviewsView from "@/components/views/ReviewsView";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ReviewsView clientId={Number(clientId)} />;
}
