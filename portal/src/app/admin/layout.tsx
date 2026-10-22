import { Shell } from "@/components/shell/page";
import { Sidebar, type NavItem } from "@/components/shell/nav";
import { requireAdmin } from "@/lib/auth/session";
import { listClients } from "@/lib/data/admin";

const items: NavItem[] = [
  { href: "/admin", label: "Clients", icon: "Users", exact: true },
  { href: "/admin/clients/new", label: "New client", icon: "Plus" },
  { href: "/admin/security", label: "Security", icon: "ShieldCheck" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const s = await requireAdmin();
  const clients = await listClients(s);
  const entries = [{ href: "/admin", label: "All clients", hint: `${clients.length} accounts` }, ...clients.map((c) => ({ href: `/admin/clients/${c.id}`, label: c.name, hint: c.planName }))];
  return <Shell sidebar={<Sidebar items={items} sub="Admin" who={s.name || s.email} title="Kynetic" entries={entries} />}>{children}</Shell>;
}
