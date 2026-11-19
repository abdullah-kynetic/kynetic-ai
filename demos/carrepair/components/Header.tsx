"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { nav, site } from "@/lib/content";
import { img } from "@/lib/img";
import { Button } from "./ui";

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 bg-page">
      <div className="mx-auto flex h-[83px] max-w-[1440px] items-center justify-between px-[30px]">
        <a href="#top" aria-label={site.name}><img src={img.logoDark} alt={site.name} width={186} height={34} className="h-[34px] w-auto" /></a>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 gap-10 text-[18px] tracking-[-0.03em] md:flex" aria-label="Main">
          {nav.map((n, i) => (
            <a key={n.label} href={n.href} className={`relative ${i === 0 ? "underline underline-offset-4" : "hover:opacity-60"}`}>{n.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Button href={`tel:${site.phone.replace(/\s/g, "")}`} className="!h-[43px] max-sm:hidden">Call&nbsp; {site.phone}</Button>
          <button className="text-2xl md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
        </div>
      </div>
      {open && (
        <motion.nav initial={{ height: 0 }} animate={{ height: "auto" }} className="overflow-hidden bg-page px-[30px] md:hidden">
          {nav.map((n) => <a key={n.label} href={n.href} onClick={() => setOpen(false)} className="block border-t border-line py-3 text-lg">{n.label}</a>)}
        </motion.nav>
      )}
    </motion.header>
  );
}
