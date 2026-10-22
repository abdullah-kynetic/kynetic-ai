"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export type SwitcherEntry = { href: string; label: string; hint?: string };

/** Sidebar account switcher. Admins list "all clients" plus each client; clients see their own business (single entry, no switching). Navigation only: access is decided server-side. */
export function Switcher({ title, sub, entries, onNavigate }: { title: string; sub: string; entries: SwitcherEntry[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  // Most specific match wins, so /admin/clients/<id>/users highlights that client, not "All clients".
  const activeHref = entries.filter((e) => pathname === e.href || pathname.startsWith(`${e.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const multi = entries.length > 1;
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const head = (
    <>
      <LogoMark className="size-8" />
      <span className="min-w-0 flex-1 text-left leading-tight">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-subtle">{sub}</span>
      </span>
      {multi ? <ChevronsUpDown className="size-4 shrink-0 text-subtle" /> : null}
    </>
  );
  const cls = "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors";
  if (!multi) return <div className={cls}>{head}</div>;
  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn(cls, "hover:bg-foreground/[0.05]")}>{head}</button>
      {open ? (
        <div role="listbox" className="absolute left-0 top-full z-40 mt-1 max-h-80 w-64 animate-pop-in overflow-auto rounded-xl border border-border-strong bg-elevated p-1 shadow-xl">
          {entries.map((e) => (
            <Link key={e.href} href={e.href} role="option" aria-selected={e.href === activeHref} onClick={() => { setOpen(false); onNavigate?.(); }}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-foreground/[0.06]">
              {e.href.endsWith("/admin") ? <LayoutGrid className="size-4 text-subtle" /> : <span className="size-4" />}
              <span className="min-w-0 flex-1"><span className="block truncate">{e.label}</span>{e.hint ? <span className="block truncate text-xs text-subtle">{e.hint}</span> : null}</span>
              {e.href === activeHref ? <Check className="size-4 text-brand-text" /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
