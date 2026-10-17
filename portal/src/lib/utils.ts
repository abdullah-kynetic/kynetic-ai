import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Format a YYYY-MM-DD (date column) or Date. Date-only strings are treated as UTC to avoid off-by-one. */
export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const v = typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d;
  return Number.isNaN(v.getTime()) ? "—" : dateFmt.format(v);
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const v = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(v.getTime()) ? "—" : dateTimeFmt.format(v);
}

export function formatNumber(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function relativeTime(d: string | Date | null | undefined) {
  if (!d) return "never";
  const v = typeof d === "string" ? new Date(d) : d;
  const s = Math.round((Date.now() - v.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(v);
}
