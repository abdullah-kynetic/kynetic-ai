import { notFound } from "next/navigation";
import Link from "next/link";
import ClientDetailTabs from "@/components/ClientDetailTabs";
import { getClient } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(Number(id));
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <Link href="/admin/clients" className="text-xs text-muted hover:text-foreground">← All clients</Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{client.name}</h1>
        <p className="text-sm text-muted">{client.industry} · viewing as admin</p>
      </div>
      <ClientDetailTabs clientId={client.id} />
      {children}
    </div>
  );
}
