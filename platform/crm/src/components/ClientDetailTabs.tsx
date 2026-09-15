"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "dashboard", label: "Dashboard" },
  { seg: "calls", label: "Calls & Bookings" },
  { seg: "reviews", label: "Reviews" },
  { seg: "leads", label: "Leads & Follow Ups" },
  { seg: "reports", label: "Monthly Report" },
];

export default function ClientDetailTabs({ clientId }: { clientId: number }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const href = `/admin/clients/${clientId}/${tab.seg}`;
        const active = pathname?.startsWith(href);
        return (
          <Link
            key={tab.seg}
            href={href}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
