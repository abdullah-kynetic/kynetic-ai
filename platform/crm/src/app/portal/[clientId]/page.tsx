import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  redirect(`/portal/${clientId}/dashboard`);
}
