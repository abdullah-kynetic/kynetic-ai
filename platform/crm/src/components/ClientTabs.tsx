"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "calls", label: "Calls" },
  { seg: "bookings", label: "Bookings" },
  { seg: "analytics", label: "Analytics" },
];

export default function ClientTabs({ clientId }: { clientId: number }) {
  const pathname = usePathname();

  return (
    <div className="tabs">
      {TABS.map((tab) => {
        const href = `/clients/${clientId}/${tab.seg}`;
        const active = pathname === href;
        return (
          <Link key={tab.seg} href={href} className={`tab${active ? " active" : ""}`}>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
