"use client";
import { motion, useScroll, useMotionValueEvent } from "motion/react";
import { useState } from "react";
import { nav, site } from "@/lib/content";
import { Button } from "./ui";

export function Header() {
  const { scrollY } = useScroll();
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setStuck(v > 24));
  return (
    <motion.header initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors ${stuck ? "bg-white/90 shadow-sm backdrop-blur" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <a href="#top" className="flex items-center gap-2 text-lg font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-sun text-xs text-ink">C</span>{site.name}
        </a>
        <nav className="hidden gap-8 text-sm md:flex" aria-label="Main">
          {nav.map((n) => <a key={n.label} href={n.href} className="hover:opacity-60">{n.label}</a>)}
        </nav>
        <div className="flex items-center gap-3">
          <Button href={`tel:${site.phone.replace(/\s/g, "")}`} className="!px-4 !py-2 max-sm:hidden">Call {site.phone}</Button>
          <button className="md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
        </div>
      </div>
      {open && (
        <motion.nav initial={{ height: 0 }} animate={{ height: "auto" }} className="overflow-hidden bg-white px-5 md:hidden">
          {nav.map((n) => <a key={n.label} href={n.href} onClick={() => setOpen(false)} className="block border-t border-line py-3">{n.label}</a>)}
        </motion.nav>
      )}
    </motion.header>
  );
}
