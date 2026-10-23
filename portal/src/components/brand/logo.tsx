import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
            <rect width="32" height="32" rx="8" fill="var(--color-brand)" />
      <path d="M11 8v16M11 16l9-8M13.5 14l7.5 10" stroke="#0e0d0b" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ className, sub }: { className?: string; sub?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Kynetic</div>
        {sub ? <div className="text-[10px] uppercase tracking-[0.14em] text-subtle">{sub}</div> : null}
      </div>
    </div>
  );
}
