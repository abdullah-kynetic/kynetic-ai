"use client";
import { motion } from "motion/react";
import { serviceOptions, site, ticker } from "@/lib/content";
import { img } from "@/lib/img";
import { ease } from "./ui";

const field = "h-[50px] w-full rounded-full border border-line bg-white px-5 text-[16px] outline-none placeholder:text-muted/70 focus:border-black";
const label = "mt-[18px] block text-[15px] tracking-[-0.02em]";

export function Hero() {
  return (
    <section id="top">
      <div className="mx-[30px] max-w-[1380px] min-[1440px]:mx-auto">
        <div className="relative min-h-[757px] overflow-hidden rounded-[40px] bg-black max-md:min-h-[820px]">
          <motion.img src={img.hero} alt="" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease }}
            className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative flex min-h-[757px] flex-col justify-end gap-10 p-6 md:p-20 md:pb-[50px] lg:flex-row lg:items-end lg:justify-between max-md:min-h-[820px]">
            <div className="pb-0">
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="eyebrow !text-[14px] !tracking-[.05em] !text-white">{site.est}</motion.p>
              <h1 className="mt-2 font-[family-name:var(--font-head)] text-[56px] font-medium leading-[1.05] tracking-[-0.03em] text-white sm:text-[100px] sm:leading-[1.15]">
                {["Honest repairs.", "Every make"].map((l, i) => (
                  <span key={l} className="block overflow-hidden pb-1">
                    <motion.span className="block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease, delay: 0.35 + i * 0.12 }}>{l}</motion.span>
                  </span>
                ))}
              </h1>
            </div>
            <motion.form onSubmit={(e) => e.preventDefault()} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.6 }}
              id="contact" className="w-full rounded-[24px] bg-white p-[30px] lg:absolute lg:bottom-[30px] lg:right-[30px] lg:w-[400px]">
              <h2 className="font-[family-name:var(--font-head)] text-[24px] font-medium tracking-[-0.04em]">Reserve your service appointment</h2>
              <label className={label}>Full name*<input required className={`${field} mt-2`} placeholder="Enter your full name" /></label>
              <label className={label}>Email address<input type="email" className={`${field} mt-2`} placeholder="hello@yourbrand.com" /></label>
              <label className={label}>Phone number*<input required type="tel" className={`${field} mt-2`} placeholder="Your contact number" /></label>
              <label className={label}>Location*
                <select required defaultValue="" className={`${field} mt-2 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 fill=%22none%22 stroke=%22black%22 stroke-width=%222%22><path d=%22M2 4l5 5 5-5%22/></svg>')] bg-[length:14px] bg-[position:right_20px_center] bg-no-repeat`}>
                  <option value="" disabled>Select…</option>{serviceOptions.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="mt-5 h-[42px] w-full rounded-full bg-sun/80 text-[16px] font-medium">Book appointment</motion.button>
            </motion.form>
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
