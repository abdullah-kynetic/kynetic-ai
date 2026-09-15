import { ensureReady, sql } from "./db";
import type { Booking, Call, Client, FollowUp, MonthlyReport } from "./types";

function toClient(r: Record<string, unknown>): Client {
  return {
    id: r.id as number,
    name: r.name as string,
    industry: r.industry as string,
    mrr: r.mrr as number,
    contractStart: new Date(r.contract_start as string).toISOString(),
    status: r.status as Client["status"],
    stripeStatus: r.stripe_status as Client["stripeStatus"],
    receptionistStatus: r.receptionist_status as Client["receptionistStatus"],
    reviewAutomationStatus: r.review_automation_status as Client["reviewAutomationStatus"],
    nurtureStatus: r.nurture_status as Client["nurtureStatus"],
    googleRatingBefore: Number(r.google_rating_before),
    googleRatingNow: Number(r.google_rating_now),
    reviewsRequested: r.reviews_requested as number,
    reviewsReceived: r.reviews_received as number,
  };
}

function toCall(r: Record<string, unknown>): Call {
  return {
    id: r.id as number,
    clientId: r.client_id as number,
    callerName: r.caller_name as string,
    callerPhone: r.caller_phone as string,
    occurredAt: new Date(r.occurred_at as string).toISOString(),
    outcome: r.outcome as Call["outcome"],
    booked: r.booked as boolean,
  };
}

function toBooking(r: Record<string, unknown>): Booking {
  return {
    id: r.id as number,
    clientId: r.client_id as number,
    customerName: r.customer_name as string,
    service: r.service as string,
    scheduledAt: new Date(r.scheduled_at as string).toISOString(),
    status: r.status as string,
  };
}

function toFollowUp(r: Record<string, unknown>): FollowUp {
  return {
    id: r.id as number,
    clientId: r.client_id as number,
    name: r.name as string,
    phone: r.phone as string,
    source: r.source as string,
    stage: r.stage as FollowUp["stage"],
    lastContactAt: new Date(r.last_contact_at as string).toISOString(),
  };
}

function toReport(r: Record<string, unknown>): MonthlyReport {
  return {
    id: r.id as number,
    clientId: r.client_id as number,
    month: r.month as string,
    callsAnswered: r.calls_answered as number,
    jobsBooked: r.jobs_booked as number,
    revenueRecovered: r.revenue_recovered as number,
    missedCallsSaved: r.missed_calls_saved as number,
    reviewsGained: r.reviews_gained as number,
    summary: r.summary as string,
  };
}

export async function getClients(): Promise<Client[]> {
  await ensureReady();
  const rows = await sql`SELECT * FROM clients ORDER BY mrr DESC`;
  return rows.map(toClient);
}

export async function getClient(id: number): Promise<Client | null> {
  await ensureReady();
  const rows = await sql`SELECT * FROM clients WHERE id = ${id}`;
  return rows[0] ? toClient(rows[0]) : null;
}

export async function getCalls(clientId: number): Promise<Call[]> {
  await ensureReady();
  const rows = await sql`SELECT * FROM calls WHERE client_id = ${clientId} ORDER BY occurred_at DESC`;
  return rows.map(toCall);
}

export async function getBookings(clientId: number): Promise<Booking[]> {
  await ensureReady();
  const rows = await sql`SELECT * FROM bookings WHERE client_id = ${clientId} ORDER BY scheduled_at ASC`;
  return rows.map(toBooking);
}

export async function getFollowUps(clientId: number): Promise<FollowUp[]> {
  await ensureReady();
  const rows = await sql`SELECT * FROM followups WHERE client_id = ${clientId} ORDER BY last_contact_at DESC`;
  return rows.map(toFollowUp);
}

export async function getReports(clientId: number): Promise<MonthlyReport[]> {
  await ensureReady();
  const rows = await sql`SELECT * FROM monthly_reports WHERE client_id = ${clientId} ORDER BY month DESC`;
  return rows.map(toReport);
}
