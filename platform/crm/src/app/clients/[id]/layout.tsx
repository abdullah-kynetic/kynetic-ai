import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/mock";
import ClientTabs from "@/components/ClientTabs";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = getClient(Number(id));
  if (!client) notFound();

  return (
    <>
      <div className="topbar">
        <div>
          <Link href="/clients" className="crumb">← All clients</Link>
          <h1>{client.name}</h1>
          <div className="sub">{client.trade} · {client.plan}</div>
        </div>
      </div>
      <section className="view">
        <ClientTabs clientId={client.id} />
        {children}
      </section>
    </>
  );
}
