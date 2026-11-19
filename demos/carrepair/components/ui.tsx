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
  { href: string; children: React.ReactNode; variant?: "sun" | "white" | "glass" | "outline"; className?: string }) {
  const styles = {
    sun: "bg-sun text-black",
    white: "bg-white text-black",
    glass: "bg-white/10 text-white ring-1 ring-white/20 backdrop-blur",
    outline: "border border-line text-black",
  }[variant];
  return (
    <motion.a href={href} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.2 }}
      className={`inline-flex h-[43px] items-center gap-2 rounded-full px-[26px] text-[15px] font-medium tracking-[-0.02em] ${styles} ${className}`}>
      {children}
    </motion.a>
  );
}

