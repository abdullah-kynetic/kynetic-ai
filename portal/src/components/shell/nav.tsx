"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, LogOut, type LucideIcon } from "lucide-react";
import { Switcher, type SwitcherEntry } from "@/components/shell/switcher";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { LogoMark } from "@/components/brand/logo";
import { Sheet } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth/actions";
import * as Icons from "lucide-react";

export type NavItem = { href: string; label: string; icon: keyof typeof Icons; exact?: boolean };

function Items({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5">
      {items.map((i) => {
        const Icon = Icons[i.icon] as LucideIcon;
        const active = i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
        return (
          <Link key={i.href} href={i.href} onClick={onNavigate} aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors", active ? "bg-foreground/[0.07] text-foreground" : "text-muted hover:bg-foreground/[0.04] hover:text-foreground")}>
            <Icon className={cn("size-4", active && "text-brand-hover")} />{i.label}
          </Link>
        );
      })}
    </nav>
  );
}

type SidebarProps = { items: NavItem[]; sub: string; who: string; title: string; entries: SwitcherEntry[] };

function Panel({ items, sub, who, title, entries, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center gap-1"><Switcher title={title} sub={sub} entries={entries} onNavigate={onNavigate} /><ThemeToggle /></div>
      <Items items={items} onNavigate={onNavigate} />
      <div className="mt-auto grid gap-2 border-t border-border pt-4">
        <div className="truncate px-2 text-sm text-muted">{who}</div>
        <Link href="/account" onClick={onNavigate} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/[0.04] hover:text-foreground">Account</Link>
        <form action={logout}><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/[0.04] hover:text-foreground"><LogOut className="size-4" />Sign out</button></form>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-surface lg:block"><Panel {...props} /></aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2"><LogoMark className="size-7" /><span className="text-sm font-semibold">{props.title}</span></div>
        <div className="flex items-center gap-1"><ThemeToggle /><button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-foreground/5"><Menu className="size-5" /></button></div>
      </header>
      <Sheet open={open} onOpenChange={setOpen} label="Navigation"><Panel {...props} onNavigate={() => setOpen(false)} /></Sheet>
    </>
  );
}
