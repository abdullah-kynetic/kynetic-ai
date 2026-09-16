export default function StatusPill({ status, label }: { status: "good" | "warn" | "crit" | "neutral"; label: string }) {
  return <span className={`pill ${status}`}>{label}</span>;
}
