"use client";
import { motion } from "motion/react";
import { serviceOptions, site, ticker } from "@/lib/content";
import { ease } from "./ui";

const field = "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-dark";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-ink text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,#4a3d36,transparent_60%)]" aria-hidden />
      <div className="relative mx-auto grid min-h-[640px] max-w-7xl items-end gap-10 px-5 pb-16 pt-32 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="eyebrow !text-white/70">{site.est}</motion.p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
            {["Honest repairs.", "Every make."].map((l, i) => (
              <span key={l} className="block overflow-hidden">
                <motion.span className="block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease, delay: 0.25 + i * 0.12 }}>{l}</motion.span>
              </span>
            ))}
          </h1>
        </div>
        <motion.form onSubmit={(e) => e.preventDefault()} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.5 }}
          id="contact" className="rounded-2xl bg-white p-6 text-dark shadow-2xl">
          <h2 className="text-base font-semibold">Reserve your service appointment</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-xs">Full name*<input required className={field} placeholder="Enter your full name" /></label>
            <label className="text-xs">Email address<input type="email" className={field} placeholder="you@example.com" /></label>
            <label className="text-xs">Phone number*<input required type="tel" className={field} placeholder="Your contact number" /></label>
            <label className="text-xs">Service*
              <select required className={field} defaultValue=""><option value="" disabled>Select…</option>{serviceOptions.map((o) => <option key={o}>{o}</option>)}</select>
            </label>
          </div>
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="mt-5 w-full rounded-full bg-dark py-3 text-sm font-semibold text-white">Book appointment</motion.button>
        </motion.form>
      </div>
      <Ticker />
    </section>
  );
}

export function Ticker() {
  const items = [...ticker, ...ticker];
  return (
    <div className="relative overflow-hidden border-t border-white/10 bg-ink py-4" aria-hidden>
      <motion.div className="flex w-max gap-10 whitespace-nowrap text-xs uppercase tracking-widest text-white/60"
        animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, ease: "linear", repeat: Infinity }}>
        {items.map((t, i) => <span key={i} className="flex gap-10">{t}<span className="text-sun">•</span></span>)}
      </motion.div>
    </div>
  );
}
