import { Shell } from "@/components/shell/page";
import { Sidebar, type NavItem } from "@/components/shell/nav";
import { requireAdmin } from "@/lib/auth/session";

const items: NavItem[] = [
  { href: "/admin", label: "Clients", icon: "Users", exact: true },
  { href: "/admin/clients/new", label: "New client", icon: "Plus" },
  { href: "/admin/security", label: "Security", icon: "ShieldCheck" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const s = await requireAdmin();
  return <Shell sidebar={<Sidebar items={items} sub="Admin" who={s.name || s.email} />}>{children}</Shell>;
}
