"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import * as c from "@/lib/content";
import { Button, Counter, Placeholder, Reveal, Stagger, item, Star } from "./ui";

export function Services() {
  return (
    <section id="services" className="mx-auto max-w-7xl px-5 py-20">
      <div className="flex items-end justify-between">
        <Reveal><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">What we do</h2></Reveal>
        <a href="#pricing" className="text-sm underline underline-offset-4">View all services</a>
      </div>
      <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {c.services.map((s) => (
          <motion.article key={s.title} variants={item} whileHover={{ y: -6 }} className="group overflow-hidden rounded-2xl bg-cream">
            <Placeholder label={s.title} tone="dark" className="aspect-[4/3]" />
            <div className="p-5"><h3 className="font-semibold">{s.title}</h3><p className="mt-2 text-sm text-muted">{s.body}</p></div>
          </motion.article>
        ))}
      </Stagger>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20">
      <div className="grid overflow-hidden rounded-3xl bg-cream lg:grid-cols-2">
        <div className="relative">
          <Placeholder label="Workshop photo" className="h-full min-h-[420px]" />
          <div className="absolute bottom-6 left-6 flex gap-10 text-white">
            {c.stats.map((s) => (
              <div key={s.label}>
                <div className="text-5xl font-semibold"><Counter to={s.format === "k" ? 12.4 : s.value} decimals={s.format === "k" ? 1 : 0} suffix={s.format === "k" ? "k" : ""} /></div>
                <div className="text-xs text-white/70">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-8 sm:p-12">
          <p className="eyebrow">How it works</p>
          <Stagger className="mt-6 grid gap-6">
            {c.steps.map((s, i) => (
              <motion.div variants={item} key={s.title} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sun text-sm font-semibold">0{i + 1}</span>
                <div><h3 className="font-semibold">{s.title}</h3><p className="mt-1 text-sm text-muted">{s.body}</p></div>
              </motion.div>
            ))}
          </Stagger>
          <div className="mt-8 flex flex-wrap gap-3"><Button href="#contact" variant="dark">Book appointment</Button><Button href="tel:+12025550147" variant="ghost" className="!bg-transparent !text-dark ring-dark/30">{c.site.phone}</Button></div>
        </div>
      </div>
    </section>
  );
}

export function Why() {
  return (
    <section className="mx-auto max-w-5xl px-5 pb-20 text-center">
      <Reveal><p className="eyebrow">Why choose us</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-2xl font-medium leading-snug sm:text-4xl">From fixed-price quotes to industry-leading diagnostics, every service is designed to give you complete confidence in your vehicle and the team working on it.</h2></Reveal>
      <Stagger className="mt-12 grid gap-8 sm:grid-cols-3">
        {c.why.map((w) => (<motion.div variants={item} key={w.title}><div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-sun">✓</div><h3 className="mt-4 font-semibold">{w.title}</h3><p className="mt-2 text-sm text-muted">{w.body}</p></motion.div>))}
      </Stagger>
      <p className="eyebrow mt-16">Trusted by thousands of customers</p>
      <Stagger className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5" gap={0.05}>
        {c.logos.map((l) => <motion.div variants={item} key={l} className="rounded-xl border border-line py-4 text-sm font-semibold text-muted">{l}</motion.div>)}
        <motion.div variants={item} className="rounded-xl py-4 text-sm text-muted">+ Many more</motion.div>
      </Stagger>
    </section>
  );
}

export function CaseStudy() {
  const k = c.caseStudy;
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20">
      <Reveal><h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Real repairs. Real results.</h2></Reveal>
      <Reveal className="mt-8 grid overflow-hidden rounded-3xl bg-dark text-white lg:grid-cols-2">
        <Placeholder label="Repair photo" className="min-h-[360px]" />
        <div className="flex flex-col justify-between gap-8 p-8 sm:p-12">
          <div><h3 className="text-3xl font-semibold">{k.car}</h3><p className="mt-1 text-white/70">{k.title}</p>
            <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
              {[["Issue", k.issue], ["Diagnosis", k.diagnosis], ["Repair time", k.time]].map(([a, b]) => <div key={a}><dt className="text-white/50">{a}:</dt><dd className="mt-1">{b}</dd></div>)}
            </dl></div>
          <div><p className="text-lg">“{k.quote}”</p><p className="mt-3 text-sm text-white/60">— {k.who}</p></div>
        </div>
      </Reveal>
    </section>
  );
}

export function Reviews() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal><p className="eyebrow">User feedback</p><h2 className="mt-3 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">Trusted by people who hate being ripped off.</h2></Reveal>
        <Reveal className="text-right"><div className="text-6xl font-semibold"><Counter to={4.9} decimals={1} /></div><div className="text-xs text-muted">412 verified Google reviews</div></Reveal>
      </div>
      <Stagger className="mt-10 grid gap-5 md:grid-cols-3">
        {c.reviews.map((r) => (
          <motion.figure key={r.name} variants={item} whileHover={{ y: -6 }} className="rounded-2xl border border-line bg-white p-6">
            <div className="flex gap-0.5">{[0,1,2,3,4].map((i) => <Star key={i} />)}</div>
            <blockquote className="mt-4 text-sm">{r.text}</blockquote>
            <figcaption className="mt-6 flex items-center gap-3 text-sm"><span className="grid h-9 w-9 place-items-center rounded-full bg-cream font-semibold">{r.name[0]}</span><span><b className="block">{r.name}</b><span className="text-muted">{r.car}</span></span></figcaption>
          </motion.figure>
        ))}
      </Stagger>
    </section>
  );
}

export function Team() {
  const [active, setActive] = useState(0);
  const t = c.team[active];
  return (
    <section id="about" className="mx-auto max-w-7xl px-5 pb-20">
      <p className="eyebrow mb-4">Meet the technician before the repair begins</p>
      <div className="grid overflow-hidden rounded-3xl bg-dark text-white lg:grid-cols-[.8fr_1.2fr]">
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="relative">
            <Placeholder label={`${t.name} portrait`} className="min-h-[360px] h-full" />
            <div className="absolute bottom-4 left-4 rounded-lg bg-black/50 px-3 py-2 text-sm backdrop-blur"><b>{t.name}</b><br /><span className="text-white/70">{t.role}</span></div>
          </motion.div>
        </AnimatePresence>
        <div className="flex flex-col justify-center p-8 sm:p-12">
          <span className="text-5xl text-sun" aria-hidden>“</span>
          <p className="text-xl leading-relaxed sm:text-2xl">{c.founderQuote}</p>
          <div className="mt-8"><Button href="#contact">Book your car in</Button></div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {c.team.map((m, i) => (
          <motion.button key={m.name} onClick={() => setActive(i)} whileTap={{ scale: 0.97 }} aria-pressed={i === active}
            className={`relative rounded-xl border p-3 text-left text-sm ${i === active ? "border-dark" : "border-line"}`}>
            {i === active && <motion.span layoutId="team-ring" className="absolute inset-0 rounded-xl ring-2 ring-sun" />}
            <b className="block">{m.name}</b><span className="text-xs text-muted">{m.role}</span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-5xl px-5 pb-20">
      <Reveal><p className="eyebrow">Pricing you can trust</p><h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Prices you can see before you call.</h2></Reveal>
      <div className="mt-10 border-t border-line">
        <div className="flex justify-between py-3 text-xs text-muted"><span>Service</span><span>Price</span></div>
        {c.prices.map((p, i) => (
          <motion.div key={p.name} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.5 }}
            whileHover={{ backgroundColor: "#f7f4ee" }} className="flex items-center justify-between gap-4 border-t border-line px-2 py-5">
            <div><b>{p.name}</b>{p.tag && <span className="ml-3 rounded-full bg-sun px-2 py-0.5 text-[10px] font-semibold">{p.tag}</span>}<p className="mt-1 text-sm text-muted">{p.desc}</p></div>
            <span className="shrink-0 font-semibold">{p.price}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Guarantee() {
  const q = c.quote;
  return (
    <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-20 lg:grid-cols-2">
      <Reveal className="rounded-3xl bg-dark p-8 text-white sm:p-12">
        <p className="eyebrow !text-white/60">Our guarantee</p>
        <h2 className="mt-3 text-4xl font-semibold">If we fix it, we stand behind it.</h2>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">{c.guarantee.map((g) => <span key={g} className="rounded-full bg-white/10 px-3 py-1.5">{g}</span>)}</div>
        <motion.div initial={{ scale: 0.8, rotate: -8, opacity: 0 }} whileInView={{ scale: 1, rotate: 0, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="mx-auto mt-10 grid h-52 w-52 place-items-center rounded-full bg-sun text-center text-ink">
          <div><div className="text-7xl font-bold leading-none">12</div><div className="text-xs">month / 12,000 miles</div><div className="mt-1 text-xs font-semibold uppercase tracking-widest">Guarantee repair</div></div>
        </motion.div>
      </Reveal>
      <Reveal delay={0.1} className="rounded-3xl bg-cream p-8 sm:p-12">
        <motion.div whileHover={{ rotate: -1.5 }} className="mx-auto max-w-sm rounded-xl bg-white p-6 text-sm shadow-xl">
          <div className="flex justify-between text-xs text-muted"><b className="text-dark">{c.site.name}</b><span>{q.ref}</span></div>
          <p className="mt-3 font-semibold">{q.car} <span className="text-muted">· {q.plate}</span></p>
          <div className="mt-3 grid gap-2">{q.lines.map(([a, b]) => <div key={a} className="flex justify-between"><span>{a}</span><span>{b}</span></div>)}</div>
          <div className="mt-3 flex justify-between border-t border-dashed border-line pt-3 font-bold"><span>Fixed total</span><span>{q.total}</span></div>
          <p className="mt-3 text-center text-xs text-muted">Awaiting your approval</p>
        </motion.div>
        <h2 className="mt-8 text-3xl font-semibold">See the bill before we lift a spanner</h2>
        <p className="mt-2 text-sm text-muted">The quote is the price. Full stop.</p>
      </Reveal>
    </section>
  );
}

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <Reveal><p className="eyebrow">Frequently asked questions</p><h2 className="mt-3 text-4xl font-semibold tracking-tight">Questions about servicing &amp; repairs?</h2></Reveal>
        <div className="mt-8 rounded-2xl bg-cream p-6"><h3 className="font-semibold">Got vehicle questions?</h3><p className="mt-1 text-sm text-muted">Need advice before booking? Reach out to our team for fast and friendly support.</p><a href="tel:+12025550147" className="mt-4 inline-block text-sm font-semibold underline">Talk to us {c.site.phone}</a></div>
      </div>
      <div className="divide-y divide-line border-y border-line">
        {c.faqs.map((f, i) => (
          <div key={f.q}>
            <button className="flex w-full items-center justify-between gap-4 py-5 text-left font-medium" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              {f.q}<motion.span animate={{ rotate: open === i ? 45 : 0 }} className="text-2xl leading-none">+</motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden"><p className="pb-5 text-sm text-muted">{f.a}</p></motion.div>}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CTAFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-5 py-24 text-center">
        <Reveal><p className="eyebrow !text-white/60">Ready when you are</p><h2 className="mt-4 text-6xl font-semibold tracking-tight sm:text-8xl">Book your car in today.</h2>
          <div className="mt-8 flex justify-center gap-3"><Button href="#contact">Book your car in</Button><Button href="tel:+12025550147" variant="ghost">Call {c.site.phone}</Button></div></Reveal>
      </div>
      <div className="mx-auto grid max-w-7xl gap-10 border-t border-white/10 px-5 py-12 text-sm sm:grid-cols-4">
        <div><b className="text-lg">{c.site.name}</b><p className="mt-3 text-white/60">Get service reminders and seasonal check-ups. No spam, just the stuff that keeps your car healthy.</p>
          <form onSubmit={(e) => e.preventDefault()} className="mt-4 flex overflow-hidden rounded-full bg-white/10"><input type="email" aria-label="Email" placeholder="Your email" className="w-full bg-transparent px-4 py-2 outline-none" /><button className="bg-sun px-4 text-ink" aria-label="Subscribe">→</button></form></div>
        <div><p className="eyebrow !text-white/50">Pages</p><ul className="mt-3 grid gap-2">{c.nav.map((n) => <li key={n.label}><a href={n.href}>{n.label}</a></li>)}<li>Privacy Policy</li><li>Terms &amp; Conditions</li></ul></div>
        <div><p className="eyebrow !text-white/50">Visit</p><p className="mt-3 text-white/80">{c.site.address}</p><p className="mt-2 text-white/80">{c.site.hours}</p><p className="mt-2">{c.site.phone}</p></div>
        <div><p className="eyebrow !text-white/50">Social</p><ul className="mt-3 grid gap-2"><li>Instagram</li><li>Facebook</li><li>X</li></ul></div>
      </div>
      <div className="overflow-hidden text-center text-[18vw] font-bold leading-none tracking-tighter text-white/[0.04]" aria-hidden>CARREPAIR</div>
      <p className="border-t border-white/10 py-5 text-center text-xs text-white/40">© 2026 {c.site.name}. All rights reserved.</p>
    </footer>
  );
}
