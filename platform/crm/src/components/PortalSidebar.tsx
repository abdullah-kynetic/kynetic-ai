"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { seg: "dashboard", label: "Dashboard", icon: "◆" },
  { seg: "calls", label: "Calls & Bookings", icon: "☎" },
  { seg: "reviews", label: "Reviews", icon: "★" },
  { seg: "leads", label: "Leads & Follow Ups", icon: "▤" },
  { seg: "reports", label: "Monthly Report", icon: "▦" },
];

export default function PortalSidebar({ clientId, clientName }: { clientId: number; clientName: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-border bg-surface px-4 py-3 md:h-screen md:w-56 md:border-b-0 md:border-r md:px-3 md:py-6">
      <div className="mb-6 px-1">
        <div className="text-xs text-muted">Client Portal</div>
        <div className="truncate text-sm font-semibold tracking-tight">{clientName}</div>
      </div>
      <nav className="flex gap-1 overflow-x-auto md:flex-col">
        {NAV.map((item) => {
          const href = `/portal/${clientId}/${item.seg}`;
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={item.seg}
              href={href}
              className={`flex flex-1 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors md:flex-none ${
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
