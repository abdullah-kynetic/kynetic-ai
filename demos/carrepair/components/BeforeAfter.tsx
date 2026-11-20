"use client";
import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { img } from "@/lib/img";
import { Reveal, ease } from "./ui";

// Drag (or swipe) the handle to wipe from the damaged truck to the repaired one.
// Vertical page scrolling still works on touch because only horizontal movement is captured.
export function BeforeAfter() {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const touched = useRef(false);
  const reduce = useReducedMotion();

  const move = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  // One gentle sweep the first time it scrolls into view, so people see that it moves.
  useEffect(() => {
    const el = box.current;
    if (!el || reduce) return;
    let raf = 0, done = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done) return;
      done = true; io.disconnect();
      const t0 = performance.now(), dur = 2600;
      const tick = (t: number) => {
        if (touched.current) return;
        const k = Math.min(1, (t - t0) / dur);
        const eased = 0.5 - 0.5 * Math.cos(k * Math.PI * 2); // 0 -> 1 -> 0
        setPos(50 + (k < 0.5 ? 1 : 1) * 0 + 38 * Math.sin(k * Math.PI * 2) * (1 - k * 0.2) * (eased > -1 ? 1 : 1));
        if (k < 1) raf = requestAnimationFrame(tick); else setPos(50);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [reduce]);

  return (
    <section className="mx-auto w-full max-w-[1440px] px-[30px] pt-[120px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Reveal><p className="eyebrow">Real repair</p><h2 className="h2 mt-2">Drag to see the difference.</h2></Reveal>
      </div>
      <Reveal className="mx-auto mt-[40px] max-w-[1100px]">
        <div
          ref={box}
          role="slider" tabIndex={0} aria-label="Before and after repair" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)}
          aria-valuetext={pos > 50 ? "Showing more of the damaged truck" : "Showing more of the repaired truck"}
          onPointerDown={(e) => { dragging.current = true; touched.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
          onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 10 : 4;
            if (e.key === "ArrowLeft") { touched.current = true; setPos((p) => Math.max(0, p - step)); e.preventDefault(); }
            if (e.key === "ArrowRight") { touched.current = true; setPos((p) => Math.min(100, p + step)); e.preventDefault(); }
            if (e.key === "Home") { setPos(0); e.preventDefault(); }
            if (e.key === "End") { setPos(100); e.preventDefault(); }
          }}
          className="relative aspect-[4/3] w-full cursor-ew-resize select-none overflow-hidden rounded-[32px] bg-dark outline-none focus-visible:ring-4 focus-visible:ring-sun max-sm:rounded-[24px]"
          style={{ touchAction: "pan-y" }}
        >
          <img src={img.after} alt="The repaired Toyota Tacoma in front of AA Auto Body Shop" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
          <img src={img.before} alt="The same truck after a front-end collision" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/60 px-4 py-1.5 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[.08em] text-white backdrop-blur-md">Before</span>
          <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-sun px-4 py-1.5 font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-[.08em] text-black">After</span>
          <div className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.15)]" style={{ left: `${pos}%` }}>
            <motion.span initial={{ scale: 0.8 }} whileInView={{ scale: 1 }} transition={{ duration: 0.6, ease }} className="absolute left-1/2 top-1/2 grid h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-sun text-[18px] shadow-lg">
              <span aria-hidden>↔</span>
            </motion.span>
          </div>
        </div>
        <p className="body mt-4 text-center">Front-end collision repair. Photos cleaned up for the web.</p>
      </Reveal>
    </section>
  );
}
