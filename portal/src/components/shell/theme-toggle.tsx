"use client";
import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Light/dark toggle. The new theme sweeps out from the button as a circle (View Transitions); older browsers and reduced-motion users get an instant swap. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = theme === "dark" ? "light" : "dark";
    const apply = () => {
      document.documentElement.dataset.theme = next;
      document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
      setTheme(next);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !document.startViewTransition) return apply();
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const t = document.startViewTransition(apply);
    t.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 550, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" },
    )).catch(() => {});
  }

  return (
    <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground", className)}>
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
