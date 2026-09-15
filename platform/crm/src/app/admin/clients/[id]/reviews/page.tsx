import ReviewsView from "@/components/views/ReviewsView";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewsView clientId={Number(id)} />;
}
