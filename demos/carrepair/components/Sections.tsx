"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import * as c from "@/lib/content";
import { img } from "@/lib/img";
import { Button, Counter, Reveal, Stagger, item, ease } from "./ui";

const wrap = "mx-auto w-full max-w-[1440px] px-[30px]";
const inner = "mx-auto w-full max-w-[1360px] px-[30px]";
const head = "font-[family-name:var(--font-head)]";

export function Services() {
  return (
    <section id="services" className={`${wrap} pt-[120px]`}>
      <div className="flex items-end justify-between gap-4">
        <Reveal><h2 className="h2">What we do</h2></Reveal>
        <Button href="#pricing" variant="outline" className="shrink-0 max-sm:hidden">View all services</Button>
      </div>
      <Stagger className="mt-[30px] grid gap-[30px] sm:grid-cols-2 lg:grid-cols-4">
        {c.services.map((s, i) => (
          <motion.article key={s.title} variants={item} whileHover={{ y: -6 }} className="rounded-[24px] bg-white p-[6px] pb-[26px]">
            <div className="relative aspect-[311/239] overflow-hidden rounded-[18px]">
              <img src={img.services[i]} alt={s.title} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
              <div className="absolute bottom-3 left-3 grid h-[60px] w-[60px] place-items-center rounded-[12px] bg-black/40 ring-1 ring-white/10 backdrop-blur-md">
                <img src={img.serviceIcons[i]} alt="" width={40} height={40} />
              </div>
            </div>
            <div className="px-5 pt-5"><h3 className={`${head} text-[23px] font-medium tracking-[-0.04em]`}>{s.title}</h3><p className="body mt-3 max-w-[225px]">{s.body}</p></div>
          </motion.article>
        ))}
      </Stagger>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className={`${inner} pt-[150px]`}>
      <div className="grid min-h-[792px] overflow-hidden rounded-[24px] bg-panel lg:grid-cols-[625px_1fr]">
        <div className="relative min-h-[520px]">
          <img src={img.how} alt="Technician reviewing a repair" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-[30px] bottom-[30px] grid grid-cols-2 gap-[30px]">
            {c.stats.map((s) => (
              <div key={s.label} className="rounded-[18px] border border-white/15 bg-gradient-to-br from-[#12233f]/80 to-black/50 p-[20px] text-white backdrop-blur-md">
                <div className={`${head} text-[56px] font-medium leading-none tracking-[-0.04em]`}><Counter to={s.format === "k" ? 12.4 : s.value} decimals={s.format === "k" ? 1 : 0} suffix={s.format === "k" ? "k" : ""} /></div>
                <div className="mt-6 border-t border-white/15 pt-3 text-right text-[16px] text-white/80">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-12 p-8 sm:p-[50px] sm:pr-[30px]">
          <div>
            <p className="eyebrow">How it works</p>
            <Stagger className="relative mt-[50px] grid gap-[30px]">
              <span className="absolute bottom-6 left-[25px] top-6 w-px bg-line" aria-hidden />
              {c.steps.map((s, i) => (
                <motion.div variants={item} key={s.title} className="relative flex gap-[16px]">
                  <span className="z-10 grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-sun font-[family-name:var(--font-mono)] text-[15px]">0{i + 1}</span>
                  <div><h3 className={`${head} text-[23px] font-medium tracking-[-0.04em]`}>{s.title}</h3><p className="body mt-1">{s.body}</p></div>
                </motion.div>
              ))}
            </Stagger>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {img.avatars.map((a) => <img key={a} src={a} alt="" width={50} height={50} className="h-[50px] w-[50px] rounded-full border-2 border-panel object-cover" />)}
              <span className="z-10 grid h-[50px] w-[50px] place-items-center rounded-full bg-dark"><img src={img.phone} alt="" width={16} height={16} /></span>
            </div>
            <div><p className="eyebrow !text-[14px]">Book appointment</p><a href="tel:+12025550147" className="text-[15px]">{c.site.phone}</a></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Why() {
  return (
    <section className={`${inner} pt-[150px] text-center`}>
      <Reveal><p className="eyebrow">Why choose us</p>
        <h2 className={`${head} mx-auto mt-4 max-w-[690px] text-[28px] font-medium leading-[1.4] tracking-[-0.045em]`}>From fixed-price quotes to industry-leading diagnostics, every service is designed to give you complete confidence in your vehicle and the team working on it.</h2></Reveal>
      <Stagger className="mx-auto mt-[60px] grid max-w-[1000px] gap-10 sm:grid-cols-3">
        {c.why.map((w, i) => (
          <motion.div variants={item} key={w.title} className="flex flex-col items-center">
            <div className="grid h-10 place-items-center"><img src={img.whyIcons[i]} alt="" width={40} height={40} /></div>
            <h3 className={`${head} mt-[30px] text-[18px] font-medium tracking-[-0.03em]`}>{w.title}</h3>
            <p className="body mx-auto mt-3 max-w-[290px]">{w.body}</p>
          </motion.div>
        ))}
      </Stagger>
      <p className="eyebrow mt-[140px]">Trusted by thousands of customers</p>
      <Stagger className="mt-[30px] grid grid-cols-2 overflow-hidden rounded-[24px] border border-line sm:grid-cols-5" gap={0.04}>
        {img.clients.map((l, i) => (
          <motion.div variants={item} key={l} className={`grid h-[100px] place-items-center border-line ${i % 5 !== 4 ? "sm:border-r" : ""} border-b`}><img src={l} alt="" className="h-5 w-auto" /></motion.div>
        ))}
        <motion.div variants={item} className="grid h-[100px] place-items-center border-b border-line text-[16px] text-muted sm:border-b-0">+ Many more</motion.div>
      </Stagger>
    </section>
  );
}

export function CaseStudy() {
  const k = c.caseStudy;
  return (
    <section className={`${wrap} pt-[150px]`}>
      <Reveal><h2 className="h2">Real repairs. Real results.</h2></Reveal>
      <Reveal className="relative mt-[50px] min-h-[792px] overflow-hidden rounded-[40px] max-lg:flex max-lg:flex-col max-lg:justify-end">
        <img src={img.caseImg} alt="Technicians reviewing a repair on a tablet" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative m-[30px] flex flex-col justify-between gap-16 rounded-[20px] bg-dark p-[60px_50px_30px_60px] text-white max-lg:p-8 lg:absolute lg:bottom-[30px] lg:right-[30px] lg:top-[30px] lg:m-0 lg:w-[610px]">
          <div>
            <h3 className={`${head} text-[34px] font-medium leading-[1.2] tracking-[-0.03em] sm:text-[44px]`}>{k.car}</h3>
            <p className={`${head} mt-0 text-[18px] tracking-[-0.03em]`}>{k.title}</p>
            <dl className="mt-[40px] grid grid-cols-1 gap-5 text-[14px] sm:grid-cols-3">
              {[["Issue:", k.issue], ["Diagnosis:", k.diagnosis], ["Repair Time:", k.time]].map(([a, b]) => <div key={a}><dt className="font-[family-name:var(--font-mono)] text-[13px] tracking-[.04em] text-white/50">{a}</dt><dd className="mt-1">{b}</dd></div>)}
            </dl>
          </div>
          <div><p className="max-w-[470px] text-[16px] leading-[1.55] tracking-[-0.015em] text-white/60">"{k.quote}"</p><p className="mt-5 text-[16px]">— {k.who}</p></div>
        </div>
      </Reveal>
    </section>
  );
}

export function Reviews() {
  return (
    <section className={`${inner} pt-[150px]`}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <Reveal><p className="eyebrow">User feedback</p><h2 className="h2 mt-2 max-w-[600px]">Trusted by people who hate being ripped off.</h2></Reveal>
        <Reveal><div className={`${head} text-[64px] font-medium leading-none tracking-[-0.04em]`}><Counter to={4.9} decimals={1} /></div><img src={img.stars} alt="5 stars" className="mt-3 h-[16px]" /><p className="mt-3 font-[family-name:var(--font-mono)] text-[14px] text-muted">412 verified Google reviews</p></Reveal>
      </div>
      <Stagger className="mt-[50px] grid gap-[30px] md:grid-cols-3">
        {c.reviews.map((r, i) => (
          <motion.figure key={r.name} variants={item} whileHover={{ y: -6 }} className="flex min-h-[270px] flex-col justify-between rounded-[24px] bg-white p-[30px]">
            <div><img src={img.stars} alt="5 stars" className="h-[14px]" /><blockquote className="body mt-[26px] max-w-[290px] text-[18px] leading-[1.4] tracking-[-0.02em]">{r.text}</blockquote></div>
            <figcaption className="mt-8 flex items-center gap-4"><img src={img.reviewers[i]} alt="" width={50} height={50} className="h-[50px] w-[50px] rounded-full object-cover" /><span><b className={`${head} block text-[18px] font-medium tracking-[-0.03em]`}>{r.name}</b><span className="font-[family-name:var(--font-mono)] text-[14px] text-muted">{r.car}</span></span></figcaption>
          </motion.figure>
        ))}
      </Stagger>
    </section>
  );
}

export function Team() {
  return (
    <section id="about" className={`${inner} pt-[150px]`}>
      <p className="eyebrow text-center">Meet the technician before the repair begins</p>
      <Reveal className="mt-[50px] grid gap-[6px] rounded-[24px] bg-white p-[6px] lg:grid-cols-2">
        <div className="relative min-h-[409px] overflow-hidden rounded-[20px]">
          <img src={img.founder} alt={c.founder.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute bottom-[40px] left-[40px] rounded-[14px] bg-black/60 p-4 text-white backdrop-blur-md"><b className={`${head} block text-[18px] font-medium tracking-[-0.03em]`}>{c.founder.name}</b><span className="font-[family-name:var(--font-mono)] text-[14px] text-white/70">{c.founder.role}</span></div>
        </div>
        <div className="flex flex-col justify-between gap-8 rounded-[20px] bg-dark p-[40px] text-white">
          <img src={img.quote} alt="" width={35} height={30} />
          <p className={`${head} text-[32px] font-medium leading-[1.25] tracking-[-0.04em]`}>{c.founderQuote}</p>
          <div><Button href="#contact">Book your car in</Button></div>
        </div>
      </Reveal>
      <Stagger className="mt-[26px] grid gap-5 sm:grid-cols-2 lg:grid-cols-4" gap={0.06}>
        {c.team.map((m, i) => (
          <motion.div key={m.name} variants={item} whileHover={{ y: -4 }} className="flex items-center gap-4 rounded-[16px] bg-white p-5">
            <img src={img.team[i]} alt={m.name} width={55} height={55} className="h-[55px] w-[55px] rounded-full object-cover" />
            <div><b className={`${head} block text-[20px] font-medium tracking-[-0.03em]`}>{m.name}</b><span className="body">{m.role}</span></div>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}

const tagStyle: Record<string, string> = { "Most popular": "bg-[#f1e2a6]", "Best value": "bg-[#cddbe7]" };
export function Pricing() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-[1040px] px-[30px] pt-[150px] min-[1100px]:px-0">
      <Reveal><p className="eyebrow">Pricing you can trust</p><h2 className="h2 mt-2 max-w-[480px]">Prices you can see before you call.</h2></Reveal>
      <div className="mt-[60px]">
        <div className="flex justify-between border-b border-line pb-5 font-[family-name:var(--font-mono)] text-[14px] text-muted"><span>Service</span><span>Price</span></div>
        {c.prices.map((p, i) => (
          <motion.div key={p.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.5, ease }}
            className="flex items-center justify-between gap-4 border-b border-line py-[18px]">
            <div><h3 className={`${head} text-[23px] font-medium tracking-[-0.04em]`}>{p.name}</h3><p className="body mt-1">{p.desc}</p></div>
            <div className="flex shrink-0 items-center gap-12">
              {p.tag && <span className={`rounded-full px-4 py-1 font-[family-name:var(--font-mono)] text-[12px] text-dark/70 max-sm:hidden ${tagStyle[p.tag]}`}>{p.tag}</span>}
              <span className={`${head} w-[90px] text-right text-[20px] font-medium tracking-[-0.03em]`}>{p.price}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Guarantee() {
  const q = c.quote;
  return (
    <section className={`${wrap} grid gap-[30px] pt-[150px] lg:grid-cols-[597fr_753fr]`}>
      <Reveal className="relative flex min-h-[845px] flex-col items-center overflow-hidden rounded-[24px] p-[30px] pt-[100px] text-center text-white">
        <img src={img.guarantee} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[3px]" />
        <div className="relative flex flex-col items-center">
          <p className="eyebrow !text-white/70">Our guarantee</p>
          <h2 className="h2 mt-3 max-w-[400px]">If we fix it, we stand behind it.</h2>
          <div className="mt-[50px] flex max-w-[380px] flex-wrap justify-center gap-[10px] text-[15px]">{c.guarantee.map((g) => <span key={g} className="rounded-full border border-white/15 px-[19px] py-[11px] tracking-[-0.02em]">{g}</span>)}</div>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 110, damping: 14 }}
            className="mt-[70px] grid h-[300px] w-[300px] place-items-center rounded-full border border-dashed border-white/15 text-black">
            <div className="grid h-[280px] w-[280px] place-items-center rounded-full bg-sun">
              <div className="text-center"><div className="font-[family-name:var(--font-mono)] text-[14px] tracking-[.1em]">CARREPAIR</div><div className={`${head} text-[130px] font-semibold leading-[1] tracking-[-0.05em]`}>12</div><div className="text-[16px]">month / 12,000 miles</div><div className="font-[family-name:var(--font-mono)] text-[14px] tracking-[.1em] text-black/60">GUARANTEE REPAIR</div></div>
            </div>
          </motion.div>
        </div>
      </Reveal>
      <Reveal delay={0.1} className="relative flex min-h-[845px] flex-col items-center overflow-hidden rounded-[24px] bg-panel p-[30px] pt-[50px] text-center">
        <div className="pointer-events-none absolute -right-[260px] top-[40px] h-[773px] w-[1022px] -rotate-[40deg] opacity-[0.16] [mask-image:linear-gradient(135deg,transparent_0%,#000_25%,#000_45%,transparent_60%)]" style={{ backgroundImage: `url(${img.checker})`, backgroundSize: "80px 40px" }} aria-hidden />
        <p className="eyebrow relative">No surprises</p>
        <motion.div initial={{ rotate: -8, y: 30, opacity: 0 }} whileInView={{ rotate: -4, y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }} whileHover={{ rotate: -1.5 }}
          className="relative mt-[60px] w-[380px] max-w-full text-left">
          <div className="flex items-center justify-between rounded-t-[14px] bg-dark px-5 pb-4 pt-5 text-white [mask-image:radial-gradient(circle_at_6px_0,transparent_5px,#000_5.5px)] [mask-size:12px_100%]">
            <span className={`${head} flex items-center gap-2 text-[17px] font-medium`}><i className="h-2 w-2 rounded-full bg-sun" />{c.site.name}</span><span className="font-[family-name:var(--font-mono)] text-[11px] text-white/70">{q.ref}</span>
          </div>
          <div className="rounded-b-[18px] bg-white px-5 pb-6 pt-4">
            <div className="flex justify-between font-[family-name:var(--font-mono)] text-[11px] uppercase text-muted"><span>{q.car}</span><span>{q.plate}</span></div>
            <div className="mt-4 grid gap-3">{q.lines.map(([a, b]) => <div key={a} className="flex justify-between border-b border-line pb-3 text-[15px] last:border-0"><span>{a}</span><span className="text-muted">{b}</span></div>)}</div>
          </div>
          <div className="mt-2 rounded-[18px] bg-white p-3">
            <div className="flex items-center justify-between rounded-[12px] bg-dark px-4 py-4 text-white"><span className="font-[family-name:var(--font-mono)] text-[12px] tracking-[.1em] text-white/60">FIXED TOTAL</span><span className={`${head} text-[22px] font-medium`}>{q.total}</span></div>
            <div className="mt-3 rounded-[12px] border border-dashed border-line py-3 text-center font-[family-name:var(--font-mono)] text-[12px] text-muted">Awaiting your approval</div>
          </div>
        </motion.div>
        <h2 className="h2 relative mt-[70px] max-w-[460px]">See the bill before we lift a spanner</h2>
        <p className="relative mt-4 flex items-center gap-2 text-[16px]"><img src={img.check} alt="" width={20} height={20} />The quote is the price. Full stop.</p>
      </Reveal>
    </section>
  );
}

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className={`${inner} grid gap-10 pt-[150px] lg:grid-cols-2`}>
      <div className="flex flex-col justify-between gap-12">
        <Reveal><p className="eyebrow">Frequently asked questions</p><h2 className="h2 mt-2 max-w-[520px]">Questions about servicing &amp; repairs?</h2></Reveal>
        <div className="max-w-[350px] rounded-[20px] bg-panel p-[30px]"><h3 className={`${head} text-[20px] font-medium tracking-[-0.03em]`}>Got vehicle questions?</h3><p className="body mt-3">Need advice before booking? Reach out to our team for fast and friendly support.</p><Button href="tel:+12025550147" variant="white" className="mt-6">Talk to us&nbsp; {c.site.phone}</Button></div>
      </div>
      <div className="max-w-[580px] lg:ml-[5px]">
        {c.faqs.map((f, i) => (
          <div key={f.q} className="border-b border-line">
            <button className="flex w-full items-center justify-between gap-4 py-[29px] text-left" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className={`${head} text-[20px] font-medium tracking-[-0.03em]`}>{f.q}</span>
              <span className="relative grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-sun"><span className="absolute h-[2px] w-[11px] bg-black" /><motion.span animate={{ scaleY: open === i ? 0 : 1 }} className="absolute h-[11px] w-[2px] bg-black" /></span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden"><p className="body pb-[25px]">{f.a}</p></motion.div>}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CTAFooter() {
  return (
    <footer className={`${wrap} pb-[30px] pt-[150px]`}>
      <div className="overflow-hidden rounded-[40px] bg-footer text-white">
        <div className="relative px-6 py-[130px] text-center">
          <img src={img.footer} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" />
          <Reveal className="relative">
            <p className="eyebrow !text-white/60">Ready when you are</p>
            <h2 className={`${head} mx-auto mt-4 max-w-[580px] text-[64px] font-medium leading-[1.1] tracking-[-0.045em] sm:text-[100px] sm:leading-[1.15]`}>Book your car in today.</h2>
            <div className="mt-[50px] flex flex-wrap justify-center gap-5"><Button href="#contact" variant="glass">Book your car in</Button><Button href="tel:+12025550147">Call&nbsp; {c.site.phone}</Button></div>
          </Reveal>
        </div>
        <div className="grid gap-10 px-[30px] py-[80px] md:grid-cols-[1fr_212px_373px] md:gap-0 md:px-[80px]">
          <div className="max-w-[360px]"><img src={img.logoLight} alt={c.site.name} width={219} height={40} className="h-10 w-auto" /><p className="mt-5 text-[15px] leading-[1.55] text-white/50">Get service reminders and seasonal check-ups. No spam, just the stuff that keeps your car healthy.</p>
            <form onSubmit={(e) => e.preventDefault()} className="mt-12 flex items-center gap-3"><input type="email" aria-label="Email" placeholder="hello@yourbrand.com" className="h-[42px] w-full rounded-full border border-white/15 bg-transparent px-5 text-[15px] outline-none placeholder:text-white/30" /><motion.button whileTap={{ scale: 0.92 }} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-sun" aria-label="Subscribe"><img src={img.arrow} alt="" width={20} height={20} /></motion.button></form></div>
          <div className=""><p className="eyebrow !text-white/50">Pages</p><ul className="mt-5 grid gap-[10px] text-[15px]">{c.nav.map((n, i) => <li key={n.label}><a href={n.href} className={i === 0 ? "underline underline-offset-4" : "hover:opacity-70"}>{n.label}</a></li>)}<li>Privacy Policy</li><li>Terms Conditions</li></ul></div>
          <div className=""><p className="eyebrow !text-white/50">Visit</p><ul className="mt-5 grid gap-[10px] text-[15px]"><li>Unit 4, Carlow Yard Bristol BS2 0QT</li><li>{c.site.hours}</li><li>{c.site.phone}</li></ul>
            <p className="eyebrow mt-8 !text-white/50">Social</p><div className="mt-5 flex gap-5">{img.social.map((s) => <img key={s} src={s} alt="" width={20} height={20} />)}</div></div>
        </div>
        <div className="border-y border-white/10 mx-[30px] overflow-hidden py-0 md:mx-[30px]" aria-hidden>
          <motion.div className={`${head} flex w-max whitespace-nowrap text-[190px] font-bold leading-[1.1] tracking-[-0.04em] text-dark`} animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, ease: "linear", repeat: Infinity }}>
            {[0, 1, 2, 3].map((i) => <span key={i}>CARREPAIR&nbsp;-&nbsp;</span>)}
          </motion.div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 px-[30px] py-[30px] font-[family-name:var(--font-mono)] text-[14px] text-white/50 md:px-[80px]"><span>© 2026 {c.site.name}. All rights reserved.</span><span>Designed by Webestica, powered by Framer.</span></div>
      </div>
    </footer>
  );
}
