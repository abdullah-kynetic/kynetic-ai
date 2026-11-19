"use client";
import { motion } from "motion/react";
import { site, ticker } from "@/lib/content";
import { img } from "@/lib/img";
import { ease } from "./ui";

const field = "h-[42px] w-full rounded-full border border-line bg-white px-4 text-[15px] outline-none placeholder:text-muted/70 focus:border-black";
const label = "mt-[12px] block text-[14px] tracking-[-0.02em]";
const arrow = "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 fill=%22none%22 stroke=%22black%22 stroke-width=%222%22><path d=%22M2 4l5 5 5-5%22/></svg>')] bg-[length:14px] bg-[position:right_16px_center] bg-no-repeat";

function EstimateCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.6 }}
      id="contact" className="w-full rounded-[24px] bg-white p-[30px] lg:absolute lg:bottom-[30px] lg:right-[30px] lg:w-[400px]">
      <h2 className="font-[family-name:var(--font-head)] text-[24px] font-medium tracking-[-0.04em]">Get your free estimate</h2>
      <p className="body mt-3">Answer a few quick questions and add photos of the damage. We&rsquo;ll call or text you with your free estimate.</p>
      <motion.a href="#estimate" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} className="mt-6 flex h-[50px] w-full items-center justify-center rounded-full bg-sun text-[16px] font-medium">Get my free estimate</motion.a>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <a href={`tel:${site.tel}`} className="flex h-[42px] items-center justify-center rounded-full border border-line text-[15px] font-medium hover:border-black">Call</a>
        <a href={`sms:${site.tel}`} className="flex h-[42px] items-center justify-center rounded-full border border-line text-[15px] font-medium hover:border-black">Text</a>
      </div>
      <p className="mt-4 text-center text-[13px] text-muted">{site.hours}</p>
    </motion.div>
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
            <EstimateCard />
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
