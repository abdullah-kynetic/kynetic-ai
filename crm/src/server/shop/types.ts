export type PaymentType = 'out_of_pocket' | 'insurance';

/** One car on the jobs board, built from a deal and its auto body custom fields. */
export type JobCard = {
  id: string;
  title: string;
  stageId: string;
  stageName: string;
  customerId: string | null;
  customerName: string | null;
  vehicle: { year: number | null; make: string | null; model: string | null };
  vehicleLabel: string;
  tech: string | null;
  ownerId: string | null;
  paymentType: PaymentType | null;
  insurer: string | null;
  claimNumber: string | null;
  amountCents: number;
  dropOffDate: string | null;
  /** Whole days since drop-off (or since the deal was created when no drop-off date is set). */
  daysInShop: number;
  createdAt: string;
  updatedAt: string;
  wonAt: string | null;
};

export type JobsStage = {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
  jobs: JobCard[];
  totalCents: number;
};

export type InsuranceRow = JobCard & { waitingDays: number };

export type QuoteRow = JobCard & { ageDays: number };

export type CloseRate = {
  won: number;
  lost: number;
  stillQuoted: number;
  /** won / (won + lost + stillQuoted) over `windowDays`; null when nothing was quoted. */
  rate: number | null;
  windowDays: number;
};

export type FollowUpStep = {
  position: number;
  channel: string;
  delayMinutes: number;
  state: 'sent' | 'next' | 'pending';
};

export type FollowUpRun = {
  id: string;
  contactId: string;
  customerName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  status: string;
  stopReason: string | null;
  currentStep: number;
  nextRunAt: string | null;
  startedAt: string;
  steps: FollowUpStep[];
  replied: boolean;
};

/** Supplement records have no table yet, so this type is the shape the page is built against. */
export type Supplement = {
  id: string;
  dealId: string;
  description: string;
  amountCents: number;
  status: 'requested' | 'approved' | 'denied';
  requestedAt: string;
};

export type TeamOwner = {
  ownerId: string | null;
  name: string;
  openJobs: JobCard[];
  totalCents: number;
};

export type MoneyInRow = {
  id: string;
  title: string;
  customerName: string | null;
  amountCents: number;
  paymentType: PaymentType | null;
  wonAt: string;
};

/** Expenses have no table yet. */
export type MoneyOutRow = {
  id: string;
  label: string;
  amountCents: number;
  paidAt: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  jobs: number;
  lifetimeCents: number;
  lastJobAt: string | null;
  /** The latest job's car ("2019 Toyota Camry"), or its title when no car details were saved. */
  lastJobLabel: string | null;
  /** True when at least one of their jobs was picked up. */
  pickedUp: boolean;
  reviewStatus: 'not_requested' | 'requested' | 'reviewed';
};

export type AwayAlerts = {
  /** Tell me right away about a call marked urgent. */
  urgentCalls: boolean;
  /** Tell me when a customer replies to a quote. */
  quoteReplies: boolean;
  /** Tell me when a car is ready and nobody has picked it up. */
  pickupsWaiting: boolean;
};

/** Away mode is a saved setting only. Nothing in the portal acts on it yet. */
export type AwaySettings = {
  enabled: boolean;
  /** First and last day away, as YYYY-MM-DD in the shop's time zone. */
  from: string | null;
  until: string | null;
  dailySummary: boolean;
  alerts: AwayAlerts;
};
