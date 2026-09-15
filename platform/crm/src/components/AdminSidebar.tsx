"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin/clients", label: "All Clients", icon: "◆" },
  { href: "/admin/health", label: "System Health", icon: "◑" },
  { href: "/admin/billing", label: "Billing", icon: "$" },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-border bg-surface px-4 py-3 md:h-screen md:w-56 md:border-b-0 md:border-r md:px-3 md:py-6">
      <div className="mb-6 flex items-center gap-2 px-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
          K
        </div>
        <span className="text-sm font-semibold tracking-tight">Kynetic Admin</span>
      </div>
      <nav className="flex gap-1 md:flex-col">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:flex-none ${
                active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <span aria-hidden className="text-xs">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
