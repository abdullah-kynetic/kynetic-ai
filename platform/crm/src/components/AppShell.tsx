"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClientsIcon } from "./icons";

// System Health and Billing nav items are added in steps 6a/6b — not yet.
const NAV = [
  { href: "/clients", label: "Clients", icon: <ClientsIcon /> },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark">K</div>
          <div className="brand-text">
            <strong>Kynetic Dispatch</strong>
            <span>Internal · v1</span>
          </div>
        </div>

        <nav>
          {NAV.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="rail-foot">
          <div className="avatar">AA</div>
          <div className="who">
            <strong>Abdullah</strong>
            <span>Kynetic AI · Admin</span>
          </div>
        </div>
      </aside>

      <main>{children}</main>
    </div>
  );
}
