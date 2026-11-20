"use client";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useCopy } from "@/lib/i18n";
import { img } from "@/lib/img";
import { Button, Counter, Reveal, Stagger, item, ease } from "./ui";

const wrap = "mx-auto w-full max-w-[1440px] px-[30px]";
const inner = "mx-auto w-full max-w-[1360px] px-[30px]";
const head = "font-[family-name:var(--font-head)]";

export function Services() {
  const c = useCopy(), u = c.ui;
  return (
    <section id="services" className={`${wrap} pt-[120px]`}>
      <div className="flex items-end justify-between gap-4">
        <Reveal><h2 className="h2">{u.whatWeDo}</h2></Reveal>
        <Button href="#estimate" variant="outline" className="shrink-0 max-sm:hidden">{u.getFree}</Button>
      </div>
      <Stagger className="mt-[30px] grid gap-[30px] sm:grid-cols-2 lg:grid-cols-3">
        {c.services.map((s, i) => (
          <motion.article key={s.title} variants={item} whileHover={{ y: -6 }} className="rounded-[24px] bg-white p-[6px] pb-[26px]">
            <div className="relative aspect-[311/239] overflow-hidden rounded-[18px]">
              <img src={img.services[i]} alt={s.title} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
              <div className="absolute bottom-3 left-3 grid h-[60px] w-[60px] place-items-center rounded-[12px] bg-black/40 font-[family-name:var(--font-mono)] text-[15px] text-white ring-1 ring-white/10 backdrop-blur-md">0{i + 1}</div>
            </div>
            <div className="px-5 pt-5"><h3 className={`${head} text-[23px] font-medium tracking-[-0.04em]`}>{s.title}</h3><p className="body mt-3 max-w-[300px]">{s.body}</p></div>
          </motion.article>
        ))}
      </Stagger>
    </section>
  );
}

export function HowItWorks() {
  const c = useCopy(), u = c.ui;
  return (
    <section className={`${inner} pt-[150px]`}>
      <div className="grid min-h-[792px] overflow-hidden rounded-[24px] bg-panel lg:grid-cols-[625px_1fr]">
        <div className="relative min-h-[520px]">
          <img src={img.how} alt={u.howAlt} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-[30px] bottom-[30px] grid grid-cols-3 gap-[12px] sm:gap-[20px]">
            {c.stats.map((s) => (
              <div key={s.label} className="rounded-[18px] border border-white/15 bg-gradient-to-br from-[#12233f]/80 to-black/50 p-[14px] text-white backdrop-blur-md sm:p-[20px]">
                <div className={`${head} text-[28px] font-medium leading-none tracking-[-0.04em] sm:text-[44px]`}><Counter to={s.value} decimals={s.decimals} suffix={s.suffix} /></div>
                <div className="mt-4 border-t border-white/15 pt-3 text-right text-[13px] leading-[1.3] text-white/80 sm:mt-6 sm:text-[15px]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-12 p-8 sm:p-[50px] sm:pr-[30px]">
          <div>
            <p className="eyebrow">{u.howItWorks}</p>
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
            <span className="grid h-[50px] w-[50px] place-items-center rounded-full bg-dark"><img src={img.phone} alt="" width={16} height={16} /></span>
            <div><p className="eyebrow !text-[14px]">{u.callOrText}</p><a href={`tel:${c.site.tel}`} className="text-[15px]">{c.site.phone}</a></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Why() {
  const c = useCopy(), u = c.ui;
  return (
    <section className={`${inner} pt-[150px] text-center`}>
      <Reveal><p className="eyebrow">{u.whyEyebrow}</p>
        <h2 className={`${head} mx-auto mt-4 max-w-[690px] text-[28px] font-medium leading-[1.4] tracking-[-0.045em]`}>{u.whyHead}</h2></Reveal>
      <Stagger className="mx-auto mt-[60px] grid max-w-[1000px] gap-10 sm:grid-cols-3">
        {c.why.map((w) => (
          <motion.div variants={item} key={w.title} className="flex flex-col items-center">
            <div className="grid h-10 place-items-center"><img src={img.check} alt="" width={40} height={40} /></div>
            <h3 className={`${head} mt-[30px] text-[18px] font-medium tracking-[-0.03em]`}>{w.title}</h3>
            <p className="body mx-auto mt-3 max-w-[290px]">{w.body}</p>
          </motion.div>
        ))}
      </Stagger>
    </section>
  );
}

export function CaseStudy() {
  const c = useCopy(), u = c.ui, k = c.caseStudy;
  return (
    <section className={`${wrap} pt-[150px]`}>
      <Reveal><h2 className="h2">{u.caseHead}</h2></Reveal>
      <Reveal className="relative mt-[50px] min-h-[792px] overflow-hidden rounded-[40px] max-lg:flex max-lg:flex-col max-lg:justify-end">
        <img src={img.caseImg} alt={u.caseAlt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative m-[30px] flex flex-col justify-between gap-16 rounded-[20px] bg-dark p-[60px_50px_30px_60px] text-white max-lg:p-8 lg:absolute lg:bottom-[30px] lg:right-[30px] lg:top-[30px] lg:m-0 lg:w-[610px]">
          <div>
            <h3 className={`${head} text-[34px] font-medium leading-[1.2] tracking-[-0.03em] sm:text-[44px]`}>{k.title}</h3>
            <p className={`${head} mt-0 text-[18px] tracking-[-0.03em]`}>{k.sub}</p>
            <dl className="mt-[40px] grid grid-cols-1 gap-5 text-[14px] sm:grid-cols-3">
              {[[u.caseLabels[0], k.issue], [u.caseLabels[1], k.did], [u.caseLabels[2], k.time]].map(([a, b]) => <div key={a}><dt className="font-[family-name:var(--font-mono)] text-[13px] tracking-[.04em] text-white/50">{a}</dt><dd className="mt-1">{b}</dd></div>)}
            </dl>
          </div>
          <div><p className="max-w-[470px] text-[16px] leading-[1.55] tracking-[-0.015em] text-white/60">&ldquo;{k.quote}&rdquo;</p><p className="mt-5 text-[16px]">— {k.who}{u.reviewOriginal && <span className="text-white/60"> ({u.reviewOriginal})</span>}</p></div>
        </div>
      </Reveal>
    </section>
  );
}

export function Reviews() {
  const c = useCopy(), u = c.ui;
  return (
    <section className={`${inner} pt-[150px]`}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <Reveal><p className="eyebrow">{u.feedback}</p><h2 className="h2 mt-2 max-w-[600px]">{u.sayHead}</h2>{u.reviewOriginal && <p className="mt-3 font-[family-name:var(--font-mono)] text-[14px] text-muted">{u.reviewOriginal[0].toUpperCase() + u.reviewOriginal.slice(1)}.</p>}</Reveal>
        <Reveal><div className={`${head} text-[64px] font-medium leading-none tracking-[-0.04em]`}><Counter to={5} decimals={1} /></div><img src={img.stars} alt={u.stars} className="mt-3 h-[16px]" /><p className="mt-3 font-[family-name:var(--font-mono)] text-[14px] text-muted">{u.ratingLine}</p></Reveal>
      </div>
      <Stagger className="mt-[50px] grid gap-[30px] md:grid-cols-3">
        {c.reviews.map((r) => (
          <motion.figure key={r.name} variants={item} whileHover={{ y: -6 }} className="flex min-h-[270px] flex-col justify-between rounded-[24px] bg-white p-[30px]">
            <div><img src={img.stars} alt={u.stars} className="h-[14px]" /><blockquote className="body mt-[26px] text-[17px] leading-[1.4] tracking-[-0.02em]">&ldquo;{r.text}&rdquo;</blockquote></div>
            <figcaption className="mt-8 flex items-center gap-4"><span aria-hidden className="grid h-[50px] w-[50px] place-items-center rounded-full bg-sun font-[family-name:var(--font-head)] text-[18px] font-medium">{r.name[0]}</span><span><b className={`${head} block text-[18px] font-medium tracking-[-0.03em]`}>{r.name}</b><span className="font-[family-name:var(--font-mono)] text-[14px] text-muted">{u.googleReview}</span></span></figcaption>
          </motion.figure>
        ))}
        <motion.a variants={item} whileHover={{ y: -6 }} href={c.site.googleReviews} target="_blank" rel="noopener noreferrer" className="flex min-h-[270px] flex-col justify-between rounded-[24px] bg-dark p-[30px] text-white">
          <div><img src={img.stars} alt="" className="h-[14px]" /><p className={`${head} mt-[26px] text-[28px] font-medium leading-[1.2] tracking-[-0.04em]`}>{u.ratingLine}</p></div>
          <span className="mt-8 flex items-center justify-between gap-4 text-[16px]">{u.readAll}<span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-sun"><img src={img.arrow} alt="" width={20} height={20} /></span></span>
        </motion.a>
      </Stagger>
    </section>
  );
}

export function Team() {
  const c = useCopy(), u = c.ui;
  return (
    <section id="about" className={`${inner} pt-[150px]`}>
      <p className="eyebrow text-center">{u.meetOwner}</p>
      <Reveal className="mt-[50px] grid gap-[6px] rounded-[24px] bg-white p-[6px] lg:grid-cols-2">
        <div className="relative min-h-[409px] overflow-hidden rounded-[20px]">
          <img src={img.founder} alt={u.founderAlt} className="absolute inset-0 h-full w-full object-cover" />
          
        </div>
        <div className="flex flex-col justify-between gap-8 rounded-[20px] bg-dark p-[40px] text-white">
          <img src={img.quote} alt="" width={35} height={30} />
          <p className={`${head} text-[26px] font-medium leading-[1.3] tracking-[-0.04em] sm:text-[28px]`}>{c.founderQuote}</p>
          <div><p className={`${head} text-[18px] font-medium tracking-[-0.03em]`}>{c.founder.name}</p><p className="font-[family-name:var(--font-mono)] text-[14px] text-white/70">{c.founder.role}</p><Button href="#estimate" className="mt-6">{u.getYour}</Button></div>
        </div>
      </Reveal>
    </section>
  );
}

export function Pricing() {
  const c = useCopy(), u = c.ui;
  return (
    <section id="pricing" className="mx-auto w-full max-w-[1040px] px-[30px] pt-[150px] min-[1100px]:px-0">
      <Reveal><p className="eyebrow">{u.pricingEyebrow}</p><h2 className="h2 mt-2 max-w-[480px]">{u.pricingHead}</h2></Reveal>
      <div className="mt-[60px]">
        <div className="flex justify-between border-b border-line pb-5 font-[family-name:var(--font-mono)] text-[14px] text-muted"><span>{u.job}</span><span>{u.howItWorksCol}</span></div>
        {c.pricing.map((p, i) => (
          <motion.div key={p.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.5, ease }}
            className="flex items-center justify-between gap-4 border-b border-line py-[18px]">
            <div><h3 className={`${head} text-[23px] font-medium tracking-[-0.04em]`}>{p.name}</h3><p className="body mt-1 max-w-[560px]">{p.desc}</p></div>
            <span className={`${head} shrink-0 text-right text-[18px] font-medium tracking-[-0.03em] sm:text-[20px]`}>{p.tag}</span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Community() {
  const c = useCopy(), u = c.ui;
  return (
    <section className={`${wrap} grid gap-[30px] pt-[150px] lg:grid-cols-[597fr_753fr]`}>
      <Reveal className="relative flex min-h-[845px] flex-col items-center overflow-hidden rounded-[24px] p-[30px] pt-[100px] text-center text-white">
        <img src={img.community} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[3px]" />
        <div className="relative flex flex-col items-center">
          <p className="eyebrow !text-white/70">{u.community}</p>
          <h2 className="h2 mt-3 max-w-[400px]">{u.sponsorHead}</h2>
          <div className="mt-[50px] flex max-w-[380px] flex-wrap justify-center gap-[10px] text-[15px]">{[c.ticker[5], c.ticker[6]].map((g) => <span key={g} className="rounded-full border border-white/15 px-[19px] py-[11px] tracking-[-0.02em]">{g}</span>)}</div>
          <motion.div initial={{ scale: 0.85, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 110, damping: 14 }}
            className="mt-[70px] grid h-[300px] w-[300px] place-items-center rounded-full border border-dashed border-white/15 text-black">
            <div className="grid h-[280px] w-[280px] place-items-center rounded-full bg-sun">
              <div className="px-8 text-center"><div className="font-[family-name:var(--font-mono)] text-[14px] tracking-[.1em]">{u.sponsorBadge}</div><div className={`${head} mt-3 text-[34px] font-semibold leading-[1.05] tracking-[-0.04em]`}>{u.sponsorName}</div></div>
            </div>
          </motion.div>
        </div>
      </Reveal>
      <Estimate />
    </section>
  );
}

export function Estimate() {
  const c = useCopy(), u = c.ui, q = c.estimate;
  return (
      <Reveal delay={0.1} className="relative flex min-h-[845px] flex-col items-center overflow-hidden rounded-[24px] bg-panel p-[30px] pt-[50px] text-center">
        <div className="pointer-events-none absolute -right-[260px] top-[40px] h-[773px] w-[1022px] -rotate-[40deg] opacity-[0.16] [mask-image:linear-gradient(135deg,transparent_0%,#000_25%,#000_45%,transparent_60%)]" style={{ backgroundImage: `url(${img.checker})`, backgroundSize: "80px 40px" }} aria-hidden />
        <p className="eyebrow relative">{u.noSurprises}</p>
        <motion.div initial={{ rotate: -8, y: 30, opacity: 0 }} whileInView={{ rotate: -4, y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }} whileHover={{ rotate: -1.5 }}
          className="relative mt-[60px] w-[380px] max-w-full text-left">
          <div className="flex items-center justify-between rounded-t-[14px] bg-dark px-5 pb-4 pt-5 text-white [mask-image:radial-gradient(circle_at_6px_0,transparent_5px,#000_5.5px)] [mask-size:12px_100%]">
            <span className={`${head} flex items-center gap-2 text-[17px] font-medium`}><i className="h-2 w-2 rounded-full bg-sun" />{c.site.name}</span><span className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-white/70">{q.label}</span>
          </div>
          <div className="rounded-b-[18px] bg-white px-5 pb-6 pt-4">
            <div className="flex justify-between font-[family-name:var(--font-mono)] text-[11px] uppercase text-muted"><span>{u.ymm}</span><span>{c.ui.freeEstimateShort}</span></div>
            <div className="mt-4 grid gap-3">{q.lines.map(([a, b]) => <div key={a} className="flex justify-between border-b border-line pb-3 text-[15px] last:border-0"><span>{a}</span><span className="text-muted">{b}</span></div>)}</div>
          </div>
          <div className="mt-2 rounded-[18px] bg-white p-3">
            <div className="flex items-center justify-between rounded-[12px] bg-dark px-4 py-4 text-white"><span className="font-[family-name:var(--font-mono)] text-[12px] tracking-[.1em] text-white/60">{u.estimateWord}</span><span className={`${head} text-[22px] font-medium`}>{u.free}</span></div>
            <div className="mt-3 rounded-[12px] border border-dashed border-line py-3 text-center font-[family-name:var(--font-mono)] text-[12px] text-muted">{u.awaiting}</div>
          </div>
        </motion.div>
        <h2 className="h2 relative mt-[70px] max-w-[460px]">{u.seeEstimate}</h2>
        <p className="relative mt-4 flex items-center gap-2 text-[16px]"><img src={img.check} alt="" width={20} height={20} />{u.approve}</p>
      </Reveal>
  );
}

export function FAQ() {
  const c = useCopy(), u = c.ui;
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className={`${inner} grid gap-10 pt-[150px] lg:grid-cols-2`}>
      <div className="flex flex-col justify-between gap-12">
        <Reveal><p className="eyebrow">{u.faqEyebrow}</p><h2 className="h2 mt-2 max-w-[520px]">{u.faqHead}</h2></Reveal>
        <div className="max-w-[350px] rounded-[20px] bg-panel p-[30px]"><h3 className={`${head} text-[20px] font-medium tracking-[-0.03em]`}>{u.gotQ}</h3><p className="body mt-3">{u.gotQBody}</p><Button href={`tel:${c.site.tel}`} variant="white" className="mt-6">{u.call}&nbsp; {c.site.phone}</Button></div>
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
  const c = useCopy(), u = c.ui;
  return (
    <footer className={`${wrap} pb-[30px] pt-[150px]`}>
      <div className="overflow-hidden rounded-[40px] bg-footer text-white">
        <div className="relative px-6 py-[130px] text-center">
          <img src={img.footer} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" />
          <Reveal className="relative">
            <p className="eyebrow !text-white/60">{u.ready}</p>
            <h2 className={`${head} mx-auto mt-4 max-w-[760px] text-[56px] font-medium leading-[1.1] tracking-[-0.045em] sm:text-[90px] sm:leading-[1.15]`}>{u.ctaHead}</h2>
            <div className="mt-[50px] flex flex-wrap justify-center gap-5"><Button href="#estimate" variant="glass">{u.getYour}</Button><Button href={`tel:${c.site.tel}`}>{u.call}&nbsp; {c.site.phone}</Button><Button href={`sms:${c.site.tel}`} variant="white">{u.textUs}</Button></div>
          </Reveal>
        </div>
        <div className="grid gap-10 px-[30px] py-[80px] md:grid-cols-[1fr_212px_373px] md:gap-0 md:px-[80px]">
          <div className="max-w-[360px]"><img src={img.logo} alt={c.site.name} width={190} height={100} className="h-[90px] w-auto rounded-[10px] bg-white p-2" /><p className="mt-5 text-[15px] leading-[1.55] text-white/50">{u.footBlurb}</p></div>
          <div><p className="eyebrow !text-white/50">{u.pages}</p><ul className="mt-5 grid gap-[2px] text-[15px] [&_a]:inline-block [&_a]:py-2">{c.nav.map((n, i) => <li key={n.label}><a href={n.href} className={i === 0 ? "underline underline-offset-4" : "hover:opacity-70"}>{n.label}</a></li>)}</ul></div>
          <div><p className="eyebrow !text-white/50">{u.visit}</p><ul className="mt-5 grid gap-[10px] text-[15px] [&_a]:inline-block [&_a]:py-2"><li>{c.site.address1}<br />{c.site.address2}</li><li>{c.hours}</li><li><a href={`tel:${c.site.tel}`} className="underline underline-offset-4">{c.site.phone}</a> · <a href={`sms:${c.site.tel}`} className="underline underline-offset-4">{u.text}</a></li><li><a href={`mailto:${c.site.email}`} className="break-all underline underline-offset-4">{c.site.email}</a></li></ul></div>
        </div>
        <div className="mx-[30px] mb-[40px] overflow-hidden rounded-[20px] md:mx-[80px]">
          <iframe title={u.mapTitle} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-[320px] w-full border-0 bg-white/5"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(c.site.mapQuery)}&output=embed`} />
        </div>
        <div className="border-y border-white/10 mx-[30px] overflow-hidden py-0 md:mx-[30px]" aria-hidden>
          <motion.div className={`${head} flex w-max whitespace-nowrap text-[190px] font-bold leading-[1.1] tracking-[-0.04em] text-dark`} animate={{ x: ["0%", "-50%"] }} transition={{ duration: 40, ease: "linear", repeat: Infinity }}>
            {[0, 1, 2, 3].map((i) => <span key={i}>AA AUTO BODY&nbsp;-&nbsp;</span>)}
          </motion.div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 px-[30px] py-[30px] font-[family-name:var(--font-mono)] text-[14px] text-white/50 md:px-[80px]"><span>© 2026 {c.site.name}</span><span>{u.by}</span></div>
      </div>
    </footer>
  );
}
