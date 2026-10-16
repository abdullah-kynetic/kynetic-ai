import { Shell } from "@/components/shell/page";
import { Sidebar, type NavItem } from "@/components/shell/nav";
import { requireClient } from "@/lib/auth/session";
import { getClient } from "@/lib/data/client";

const items: NavItem[] = [
  { href: "/", label: "Overview", icon: "LayoutDashboard", exact: true },
  { href: "/profile", label: "Business profile", icon: "Building2" },
  { href: "/contacts", label: "Contacts", icon: "Users" },
  { href: "/scope", label: "Plan 1 scope", icon: "ListChecks" },
  { href: "/timeline", label: "Timeline", icon: "Milestone" },
  { href: "/documents", label: "Documents", icon: "FileText" },
  { href: "/results", label: "Results", icon: "ChartLine" },
];

export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const s = await requireClient();
  const client = await getClient(s);
  return <Shell sidebar={<Sidebar items={items} sub="Client portal" who={s.name || s.email} org={client?.name} />}>{children}</Shell>;
}
