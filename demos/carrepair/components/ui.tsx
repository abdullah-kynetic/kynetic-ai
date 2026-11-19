"use client";
import { motion, useInView, useMotionValue, useTransform, animate, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef } from "react";

export const ease = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, delay = 0, y = 24, className = "", ...rest }:
  { children: React.ReactNode; delay?: number; y?: number; className?: string } & Omit<HTMLMotionProps<"div">, "children">) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, ease, delay }} {...rest}>
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className = "", gap = 0.09 }: { children: React.ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}>
      {children}
    </motion.div>
  );
}
export const item = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } };

export function Counter({ to, suffix = "", decimals = 0 }: { to: number; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toFixed(decimals) + suffix);
  useEffect(() => { if (inView) { const c = animate(mv, to, { duration: 1.6, ease }); return () => c.stop(); } }, [inView, to, mv]);
  return <motion.span ref={ref}>{text}</motion.span>;
}

export function Button({ href, children, variant = "sun", className = "" }:
  { href: string; children: React.ReactNode; variant?: "sun" | "dark" | "ghost"; className?: string }) {
  const styles = {
    sun: "bg-sun text-ink",
    dark: "bg-dark text-white",
    ghost: "bg-white/10 text-white ring-1 ring-white/25",
  }[variant];
  return (
    <motion.a href={href} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold ${styles} ${className}`}>
      {children}
    </motion.a>
  );
}

// Neutral placeholder in place of photography. Swap for real client photos.
export function Placeholder({ label, className = "", tone = "dark" }: { label: string; className?: string; tone?: "dark" | "cream" | "sun" }) {
  const bg = { dark: "bg-[#3a312d] text-white/40", cream: "bg-cream text-muted/60", sun: "bg-sun/80 text-ink/50" }[tone];
  return (
    <div role="img" aria-label={label} className={`relative flex items-center justify-center overflow-hidden ${bg} ${className}`}>
      <svg viewBox="0 0 64 64" className="h-12 w-12 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="6" y="14" width="52" height="36" rx="4" /><circle cx="22" cy="32" r="6" /><path d="M10 46l16-12 12 8 10-8 8 6" />
      </svg>
      <span className="absolute bottom-3 left-4 text-[10px] uppercase tracking-widest">{label}</span>
    </div>
  );
}

export const Star = () => <span className="text-sun">★</span>;
