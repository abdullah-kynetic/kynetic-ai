"use client";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCopy } from "@/lib/i18n";
import { img } from "@/lib/img";
import { Button, ease } from "./ui";

const chip = "pointer-events-none rounded-full px-4 py-1.5 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[.08em]";

// The whole hero is one before/after reveal: drag or swipe the handle to turn the wrecked truck into the repaired one.
// Vertical page scrolling still works on touch because only horizontal movement is captured.
export function Hero() {
  const { site, tagline, ui: u } = useCopy();
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const touched = useRef(false);
  const reduce = useReducedMotion();

  const move = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  // One gentle sweep shortly after load so visitors see that it moves.
  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const start = window.setTimeout(() => {
      const t0 = performance.now(), dur = 2800;
      const tick = (t: number) => {
        if (touched.current) return;
        const k = Math.min(1, (t - t0) / dur);
        setPos(50 + 36 * Math.sin(k * Math.PI * 2) * (1 - k * 0.15));
        if (k < 1) raf = requestAnimationFrame(tick); else setPos(50);
      };
      raf = requestAnimationFrame(tick);
    }, 1600);
    return () => { clearTimeout(start); cancelAnimationFrame(raf); };
  }, [reduce]);

  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const copy = (
    <div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="eyebrow !text-[13px] !tracking-[.05em] !text-white sm:!text-[14px]">{tagline}</motion.p>
      <h1 className="mt-2 font-[family-name:var(--font-head)] text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-white min-[390px]:text-[38px] sm:text-[64px] lg:text-[clamp(40px,4.4vw,72px)] lg:leading-[1.08]">
        {u.heroLines.map((l, i) => (
          <span key={i} className="block overflow-hidden pb-1">
            <motion.span className="block" initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease, delay: 0.35 + i * 0.12 }}>{l}</motion.span>
          </span>
        ))}
      </h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-3 max-w-[460px] text-[16px] leading-[1.45] tracking-[-0.02em] text-white/90 lg:text-[18px] lg:[@media(max-height:820px)]:hidden">
        {u.heroSub}
      </motion.p>
    </div>
  );
  const ctas = (
    <div data-nodrag onPointerDown={stop} className="flex flex-wrap items-center gap-3">
      <Button href="#estimate" className="!h-[50px] !px-7 !text-[16px]">{u.getMine}</Button>
      <Button href={`tel:${site.tel}`} variant="glass" className="!h-[50px] max-sm:hidden">{u.call}&nbsp; {site.phone}</Button>
      <Button href={`sms:${site.tel}`} variant="glass" className="!h-[50px] max-sm:hidden">{u.text}</Button>
    </div>
  );

  return (
    <section id="top">
      <div className="mx-[30px] max-w-[1380px] min-[1440px]:mx-auto">
        <div className="overflow-hidden rounded-[40px] bg-dark max-md:rounded-[28px] lg:relative lg:h-[clamp(540px,calc(100svh-83px-70px),860px)]">
          <div
            ref={box}
            className="relative aspect-[4/3] w-full cursor-ew-resize select-none overflow-hidden lg:absolute lg:inset-0 lg:aspect-auto"
            style={{ touchAction: "pan-y" }}
            onPointerDown={(e) => { if ((e.target as HTMLElement).closest("a,button,[data-nodrag]")) return; dragging.current = true; touched.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
            onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
            onPointerUp={() => { dragging.current = false; }}
            onPointerCancel={() => { dragging.current = false; }}
          >
            <motion.img src={img.after} alt={u.afterAlt} draggable={false} fetchPriority="high"
              initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease }} className="absolute inset-0 h-full w-full object-cover object-[50%_62%]" />
            <img src={img.before} alt={u.beforeAlt} draggable={false} className="absolute inset-0 h-full w-full object-cover object-[50%_62%]" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
            <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-[62%] bg-gradient-to-b from-black/70 via-black/35 to-transparent lg:block" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[34%] bg-gradient-to-t from-black/60 to-transparent lg:block" />
            <span className={`${chip} absolute left-4 top-4 bg-black/60 text-white backdrop-blur-md lg:bottom-6 lg:left-8 lg:top-auto`}>{u.before}</span>
            <span className={`${chip} absolute right-4 top-4 bg-sun text-black lg:bottom-6 lg:right-8 lg:top-auto`}>{u.after}</span>
            <div className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.15)]" style={{ left: `${pos}%` }}>
              <div
                role="slider" tabIndex={0} aria-label={u.slider} aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)}
                aria-valuetext={pos > 50 ? u.moreDamaged : u.moreRepaired}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 10 : 4; touched.current = true;
                  if (e.key === "ArrowLeft") { setPos((p) => Math.max(0, p - step)); e.preventDefault(); }
                  if (e.key === "ArrowRight") { setPos((p) => Math.min(100, p + step)); e.preventDefault(); }
                  if (e.key === "Home") { setPos(0); e.preventDefault(); }
                  if (e.key === "End") { setPos(100); e.preventDefault(); }
                }}
                className="pointer-events-auto absolute left-1/2 top-1/2 grid h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-sun text-[20px] shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-white"
              ><span aria-hidden>↔</span></div>
            </div>
            <div className="pointer-events-none absolute left-8 right-8 top-8 hidden lg:block xl:left-12 xl:top-10">{copy}</div>
            <div className="pointer-events-none absolute inset-x-0 bottom-5 hidden justify-center lg:flex"><div className="pointer-events-auto">{ctas}</div></div>
          </div>
          <div className="flex flex-col gap-6 px-6 pb-7 pt-6 lg:hidden">
            {copy}
            {ctas}
          </div>
        </div>
      </div>
      <Ticker />
    </section>
  );
}

export function Ticker() {
  const { ticker } = useCopy();
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
