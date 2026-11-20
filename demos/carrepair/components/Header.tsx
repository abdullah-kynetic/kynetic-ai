"use client";
import { motion } from "motion/react";
import { useState } from "react";
import { useCopy, useLang } from "@/lib/i18n";
import { img } from "@/lib/img";
import { Button } from "./ui";

function LangToggle() {
  const { lang, setLang } = useLang();
  const b = (l: "en" | "es") => `px-3 py-1.5 transition-colors ${lang === l ? "bg-dark text-white" : "hover:bg-black/5"}`;
  return (
    <div role="group" aria-label="Language / Idioma" className="inline-flex h-[43px] items-center overflow-hidden rounded-full border border-line text-[14px] font-medium tracking-[.02em]">
      <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => setLang("en")} className={`${b("en")} h-full pl-3.5`}>EN</button>
      <button type="button" lang="es" aria-pressed={lang === "es"} onClick={() => setLang("es")} className={`${b("es")} h-full pr-3.5`}>ES</button>
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { nav, site, ui: u } = useCopy();
  return (
    <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 bg-page">
      <div className="mx-auto flex h-[83px] max-w-[1440px] items-center justify-between px-[30px]">
        <a href="#top" aria-label={site.name}><img src={img.logo} alt={site.name} width={186} height={49} className="h-[56px] w-auto mix-blend-multiply" /></a>
        <nav className="absolute left-1/2 hidden -translate-x-1/2 gap-6 text-[16px] tracking-[-0.03em] md:flex lg:gap-10 lg:text-[18px]" aria-label={u.mainNav}>
          {nav.map((n, i) => (
            <a key={n.label} href={n.href} className={`relative ${i === 0 ? "underline underline-offset-4" : "hover:opacity-60"}`}>{n.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button href={`tel:${site.tel}`} className="!h-[43px] max-sm:hidden">{u.call}&nbsp; {site.phone}</Button>
          <Button href={`sms:${site.tel}`} variant="outline" className="!h-[43px] max-lg:hidden">{u.text}</Button>
          <LangToggle />
          <button className="grid h-11 w-11 place-items-center text-2xl md:hidden" aria-label={u.menu} aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
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
