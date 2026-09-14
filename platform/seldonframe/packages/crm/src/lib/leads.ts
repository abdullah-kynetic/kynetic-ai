export type Stage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

export type Lead = {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  value: number;
  stage: Stage;
  createdAt: string;
};

export const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "new", label: "New", color: "#7c9cff" },
  { key: "contacted", label: "Contacted", color: "#5eb8ff" },
  { key: "qualified", label: "Qualified", color: "#5ed6c0" },
  { key: "proposal", label: "Proposal", color: "#f5b95e" },
  { key: "won", label: "Won", color: "#5ed67e" },
  { key: "lost", label: "Lost", color: "#f56e6e" },
];

export function stageMeta(stage: string) {
  return STAGES.find((s) => s.key === stage) ?? STAGES[0];
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
