import { loadDetail } from "./load";
import { PageHeader } from "@/components/shell/page";
import { LinkTabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default async function ClientLayout({ children, params }: LayoutProps<"/admin/clients/[id]">) {
  const { id } = await params;
  const { client } = await loadDetail(id);
  const base = `/admin/clients/${id}`;
  return (
    <>
      <PageHeader title={client.name} description={`${client.planName} · ${client.includedMinutes} min/month included`} badge={<Badge variant="brand">{client.status}</Badge>} />
      <LinkTabs className="mb-6" tabs={[
        { href: base, label: "Settings", exact: true }, { href: `${base}/profile`, label: "Profile" }, { href: `${base}/contacts`, label: "Contacts" },
        { href: `${base}/scope`, label: "Scope" }, { href: `${base}/timeline`, label: "Timeline" }, { href: `${base}/documents`, label: "Documents" },
        { href: `${base}/results`, label: "Results" }, { href: `${base}/users`, label: "Users" }, { href: `${base}/keys`, label: "Ingest keys" },
      ]} />
      {children}
    </>
  );
}
