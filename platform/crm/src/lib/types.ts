export type WorkflowStatus = "running" | "degraded" | "down";
export type ClientStatus = "active" | "paused" | "churned";
export type StripeStatus = "paid" | "overdue" | "canceled";

export type Client = {
  id: number;
  name: string;
  industry: string;
  mrr: number;
  contractStart: string;
  status: ClientStatus;
  stripeStatus: StripeStatus;
  receptionistStatus: WorkflowStatus;
  reviewAutomationStatus: WorkflowStatus;
  nurtureStatus: WorkflowStatus;
  googleRatingBefore: number;
  googleRatingNow: number;
  reviewsRequested: number;
  reviewsReceived: number;
};

export type CallOutcome = "booked" | "missed_call_saved" | "inquiry" | "voicemail";

export type Call = {
  id: number;
  clientId: number;
  callerName: string;
  callerPhone: string;
  occurredAt: string;
  outcome: CallOutcome;
  booked: boolean;
};

export type Booking = {
  id: number;
  clientId: number;
  customerName: string;
  service: string;
  scheduledAt: string;
  status: string;
};

export type FollowUpStage = "new" | "contacted" | "nurture_1" | "nurture_2" | "booked" | "lost";

export type FollowUp = {
  id: number;
  clientId: number;
  name: string;
  phone: string;
  source: string;
  stage: FollowUpStage;
  lastContactAt: string;
};

export type MonthlyReport = {
  id: number;
  clientId: number;
  month: string;
  callsAnswered: number;
  jobsBooked: number;
  revenueRecovered: number;
  missedCallsSaved: number;
  reviewsGained: number;
  summary: string;
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const STATUS_COLOR: Record<WorkflowStatus, string> = {
  running: "#5ed67e",
  degraded: "#f5b95e",
  down: "#f56e6e",
};

export const FOLLOWUP_STAGES: { key: FollowUpStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "nurture_1", label: "Nurture 1" },
  { key: "nurture_2", label: "Nurture 2" },
  { key: "booked", label: "Booked" },
  { key: "lost", label: "Lost" },
];
