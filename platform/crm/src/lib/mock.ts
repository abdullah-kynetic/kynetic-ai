export type ClientStatus = "good" | "warn" | "crit";

export type Client = {
  id: number;
  name: string;
  initials: string;
  trade: string;
  status: ClientStatus;
  statusLabel: string;
  plan: string;
  calls: number;
  recovered: string;
  since: string;
};

export type CallType = "answered" | "booked" | "missed";

export type Call = {
  id: number;
  clientId: number;
  type: CallType;
  who: string;
  note: string;
  time: string;
  quote?: string;
};

export type BookingStatus = "good" | "warn" | "neutral" | "crit";

export type Booking = {
  id: number;
  clientId: number;
  job: string;
  type: string;
  when: string;
  tech: string;
  value: string;
  status: BookingStatus;
  statusLabel: string;
};

export const CLIENTS: Client[] = [
  { id: 1, name: "Ironclad Plumbing & Restoration", initials: "IP", trade: "Plumbing / Restoration", status: "good", statusLabel: "Live", plan: "Full 5-Pillar", calls: 212, recovered: "$41,200", since: "Feb 2026" },
  { id: 2, name: "Coastal Rapid Response", initials: "CR", trade: "Water & Storm Restoration", status: "good", statusLabel: "Live", plan: "Full 5-Pillar", calls: 184, recovered: "$36,800", since: "Mar 2026" },
  { id: 3, name: "Summit Plumbing Co.", initials: "SP", trade: "Plumbing", status: "good", statusLabel: "Live", plan: "Speed-to-Lead only", calls: 96, recovered: "$18,400", since: "May 2026" },
  { id: 4, name: "Harbor Fire & Flood", initials: "HF", trade: "Fire / Water Restoration", status: "good", statusLabel: "Live", plan: "Full 5-Pillar", calls: 151, recovered: "$29,600", since: "Apr 2026" },
  { id: 5, name: "Bluecrest Drain & Rooter", initials: "BD", trade: "Plumbing", status: "warn", statusLabel: "Onboarding", plan: "Speed-to-Lead only", calls: 22, recovered: "$3,900", since: "Sep 2026" },
  { id: 6, name: "Norwood Restoration Group", initials: "NR", trade: "Restoration", status: "crit", statusLabel: "Paused", plan: "Full 5-Pillar", calls: 0, recovered: "$12,700", since: "Jan 2026" },
];

export const CALLS: Call[] = [
  { id: 1, clientId: 1, type: "answered", who: "Dana R.", note: "Burst pipe, upstairs bathroom — flooding now", time: "2m ago", quote: "“Water's coming through the ceiling, I need someone today.”" },
  { id: 2, clientId: 3, type: "booked", who: "Marcus T.", note: "Booked: emergency drain snake, 4:30pm window", time: "11m ago" },
  { id: 3, clientId: 4, type: "answered", who: "Priya S.", note: "Smoke damage estimate, kitchen fire Sunday", time: "24m ago", quote: "“Insurance adjuster is coming Thursday, can you beat them there?”" },
  { id: 4, clientId: 5, type: "missed", who: "Unknown caller", note: "No answer after 3 rings — auto-texted booking link", time: "38m ago" },
  { id: 5, clientId: 1, type: "booked", who: "Alan G.", note: "Booked: water heater replacement, tomorrow 9am", time: "52m ago" },
  { id: 6, clientId: 2, type: "answered", who: "Renee K.", note: "Basement flooding after storm, wants same-day", time: "1h ago", quote: "“This is the third company I've called, everyone's booked out.”" },
  { id: 7, clientId: 3, type: "booked", who: "Tomas V.", note: "Booked: slab leak inspection, Thu 1pm", time: "1h ago" },
  { id: 8, clientId: 5, type: "answered", who: "Wendy L.", note: "Clogged main line, second call this month", time: "2h ago" },
  { id: 9, clientId: 4, type: "missed", who: "Unknown caller", note: "No answer — auto-texted booking link, no reply yet", time: "2h ago" },
  { id: 10, clientId: 2, type: "booked", who: "James O.", note: "Booked: mold assessment, Fri 10am", time: "3h ago" },
  { id: 11, clientId: 1, type: "answered", who: "Elena F.", note: "Toilet won't stop running, non-urgent", time: "3h ago" },
  { id: 12, clientId: 4, type: "booked", who: "Nate B.", note: "Booked: fire damage walkthrough, Mon 8am", time: "4h ago" },
];

export const BOOKINGS: Booking[] = [
  { id: 1, clientId: 1, job: "Burst pipe — emergency repair", type: "Emergency", when: "Today, 2:00pm", tech: "J. Alvarez", value: "$1,850", status: "good", statusLabel: "Confirmed" },
  { id: 2, clientId: 3, job: "Drain snake — kitchen line", type: "Standard", when: "Today, 4:30pm", tech: "M. Chen", value: "$420", status: "good", statusLabel: "Confirmed" },
  { id: 3, clientId: 4, job: "Smoke damage estimate", type: "Estimate", when: "Thu, 9:00am", tech: "R. Ortiz", value: "$6,200 (est.)", status: "warn", statusLabel: "Awaiting adjuster" },
  { id: 4, clientId: 1, job: "Water heater replacement", type: "Install", when: "Tomorrow, 9:00am", tech: "J. Alvarez", value: "$2,100", status: "good", statusLabel: "Confirmed" },
  { id: 5, clientId: 2, job: "Basement flood extraction", type: "Emergency", when: "Today, 6:00pm", tech: "D. Park", value: "$3,400", status: "good", statusLabel: "Confirmed" },
  { id: 6, clientId: 3, job: "Slab leak inspection", type: "Inspection", when: "Thu, 1:00pm", tech: "M. Chen", value: "$275", status: "neutral", statusLabel: "Pending confirm" },
  { id: 7, clientId: 2, job: "Mold assessment", type: "Inspection", when: "Fri, 10:00am", tech: "D. Park", value: "$450", status: "neutral", statusLabel: "Pending confirm" },
  { id: 8, clientId: 4, job: "Fire damage walkthrough", type: "Estimate", when: "Mon, 8:00am", tech: "R. Ortiz", value: "$8,900 (est.)", status: "neutral", statusLabel: "Pending confirm" },
  { id: 9, clientId: 5, job: "Main line clog — repeat visit", type: "Standard", when: "Wed, 11:00am", tech: "M. Chen", value: "$310", status: "crit", statusLabel: "Needs reschedule" },
];

export function getClient(id: number) {
  return CLIENTS.find((c) => c.id === id) ?? null;
}

export function getClientCalls(clientId: number) {
  return CALLS.filter((c) => c.clientId === clientId);
}

export function getClientBookings(clientId: number) {
  return BOOKINGS.filter((b) => b.clientId === clientId);
}

export function answerRate(clientId: number) {
  const calls = getClientCalls(clientId);
  if (calls.length === 0) return 0;
  const answered = calls.filter((c) => c.type !== "missed").length;
  return Math.round((answered / calls.length) * 100);
}

export function conversionRate(clientId: number) {
  const calls = getClientCalls(clientId);
  if (calls.length === 0) return 0;
  const booked = calls.filter((c) => c.type === "booked").length;
  return Math.round((booked / calls.length) * 100);
}
