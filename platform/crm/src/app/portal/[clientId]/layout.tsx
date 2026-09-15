import { notFound } from "next/navigation";
import PortalSidebar from "@/components/PortalSidebar";
import { getClient } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const client = await getClient(Number(clientId));
  if (!client) notFound();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <PortalSidebar clientId={client.id} clientName={client.name} />
      <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
