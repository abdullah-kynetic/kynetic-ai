"use client";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { confirmation, contactOptions, site, ticker } from "@/lib/content";
import { img } from "@/lib/img";
import { ease } from "./ui";

const field = "h-[42px] w-full rounded-full border border-line bg-white px-4 text-[15px] outline-none placeholder:text-muted/70 focus:border-black";
const label = "mt-[12px] block text-[14px] tracking-[-0.02em]";
const arrow = "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 fill=%22none%22 stroke=%22black%22 stroke-width=%222%22><path d=%22M2 4l5 5 5-5%22/></svg>')] bg-[length:14px] bg-[position:right_16px_center] bg-no-repeat";

// Nothing in this form is sent anywhere. Photos stay in the browser tab.
function EstimateForm() {
  const [done, setDone] = useState(false);
  const [thumbs, setThumbs] = useState<{ url: string; name: string }[]>([]);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/")).map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    urls.current.push(...next.map((n) => n.url));
    setThumbs((t) => [...t, ...next]);
    e.target.value = "";
  };
  return (
    <motion.form onSubmit={(e) => { e.preventDefault(); setDone(true); }} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.6 }}
      id="contact" className="w-full rounded-[24px] bg-white p-[26px] lg:absolute lg:bottom-[30px] lg:right-[30px] lg:w-[420px]">
      {done ? (
        <div role="status" className="py-10 text-center">
          <h2 className="font-[family-name:var(--font-head)] text-[24px] font-medium tracking-[-0.04em]">Thank you</h2>
          <p className="body mt-4 text-[16px] text-black">{confirmation}</p>
        </div>
      ) : (
        <>
          <h2 className="font-[family-name:var(--font-head)] text-[24px] font-medium tracking-[-0.04em]">Get your free estimate</h2>
          <label className={label}>Name*<input required name="name" autoComplete="name" className={`${field} mt-1.5`} placeholder="Your full name" /></label>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className={label}>Phone*<input required name="phone" type="tel" autoComplete="tel" className={`${field} mt-1.5`} placeholder="Your number" /></label>
            <label className={label}>Email<input name="email" type="email" autoComplete="email" className={`${field} mt-1.5`} placeholder="you@email.com" /></label>
          </div>
          <label className={label}>Year / Make / Model<input name="vehicle" className={`${field} mt-1.5`} placeholder="e.g. 2018 Honda Accord" /></label>
          <label className={label}>What happened<textarea name="what" rows={2} className={`${field} mt-1.5 !h-[64px] resize-none !rounded-[20px] py-2.5`} placeholder="A short description" /></label>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className={label}>Insurance company<input name="insurance" className={`${field} mt-1.5`} placeholder="Optional" /></label>
            <label className={label}>Claim #<input name="claim" className={`${field} mt-1.5`} placeholder="Optional" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <label className={label}>Preferred contact
              <select name="contact" defaultValue="Call" className={`${field} ${arrow} mt-1.5`}>{contactOptions.map((o) => <option key={o}>{o}</option>)}</select>
            </label>
            <label className={label}>Drop-off date<input name="date" type="date" className={`${field} mt-1.5`} /></label>
          </div>
          <label className={label}>Damage photos
            <span className="mt-1.5 flex h-[42px] cursor-pointer items-center justify-center rounded-full border border-dashed border-black/30 text-[14px] text-muted hover:border-black">+ Add photos</span>
            <input type="file" name="photos" accept="image/*" multiple onChange={onFiles} className="sr-only" />
          </label>
          {thumbs.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected photos">
              {thumbs.map((t, i) => <li key={t.url}><img src={t.url} alt={`Damage photo ${i + 1}`} title={t.name} width={44} height={44} className="h-[44px] w-[44px] rounded-[10px] object-cover" /></li>)}
            </ul>
          )}
          <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="mt-4 h-[42px] w-full rounded-full bg-sun/80 text-[16px] font-medium">Get my free estimate</motion.button>
        </>
      )}
    </motion.form>
  );
}

export function Hero() {
  return (
    <section id="top">
      <div className="mx-[30px] max-w-[1380px] min-[1440px]:mx-auto">
        <div className="relative min-h-[757px] overflow-hidden rounded-[40px] bg-black max-md:min-h-[820px] lg:min-h-[880px]">
          <motion.img src={img.hero} alt="" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease }}
            className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative flex min-h-[757px] flex-col justify-end gap-10 p-6 md:p-20 md:pb-[50px] lg:min-h-[880px] lg:flex-row lg:items-end lg:justify-between max-md:min-h-[820px]">
            <div className="pb-0">
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="eyebrow !text-[14px] !tracking-[.05em] !text-white">{site.tagline}</motion.p>
              <h1 className="mt-2 font-[family-name:var(--font-head)] text-[56px] font-medium leading-[1.05] tracking-[-0.03em] text-white sm:text-[100px] sm:leading-[1.15] lg:text-[72px] min-[1280px]:text-[100px]">
                {["Quality Work.", "Honest Service."].map((l, i) => (
                  <span key={l} className="block overflow-hidden pb-1">
                    <motion.span className="block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease, delay: 0.35 + i * 0.12 }}>{l}</motion.span>
                  </span>
                ))}
              </h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-4 max-w-[460px] text-[18px] leading-[1.45] tracking-[-0.02em] text-white/90">
                We work with your insurance company and handle the claim, so you don&rsquo;t have to worry about the process.
              </motion.p>
            </div>
            <EstimateForm />
          </div>
        </div>
      </div>
      <Ticker />
    </section>
  );
}

export function Ticker() {
  const items = [...ticker, ...ticker];
  return (
    <div className="relative overflow-hidden py-[18px] [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]" aria-hidden>
      <motion.div className="flex w-max items-center gap-[30px] whitespace-nowrap font-[family-name:var(--font-mono)] text-[14px] uppercase tracking-[.08em] text-muted"
        animate={{ x: ["0%", "-50%"] }} transition={{ duration: 45, ease: "linear", repeat: Infinity }}>
        {items.map((t, i) => (<span key={i} className="flex items-center gap-[30px]">{t}<img src={img.spark} alt="" width={21} height={21} /></span>))}
      </motion.div>
    </div>
  );
}
