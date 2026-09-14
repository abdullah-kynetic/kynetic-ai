"use server";

import { revalidatePath } from "next/cache";
import { ensureReady, sql } from "./db";
import type { Lead } from "./leads";

export async function getLeads(): Promise<Lead[]> {
  await ensureReady();
  const rows = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
  return rows.map(rowToLead);
}

export async function createLead(formData: FormData) {
  await ensureReady();
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const value = Number(formData.get("value") ?? 0) || 0;
  const stage = String(formData.get("stage") ?? "new");

  if (!name || !company || !email) return;

  await sql`
    INSERT INTO leads (name, company, email, phone, value, stage)
    VALUES (${name}, ${company}, ${email}, ${phone}, ${value}, ${stage})
  `;
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/analytics");
}

export async function updateLeadStage(id: number, stage: string) {
  await ensureReady();
  await sql`UPDATE leads SET stage = ${stage} WHERE id = ${id}`;
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/analytics");
}

export async function deleteLead(id: number) {
  await ensureReady();
  await sql`DELETE FROM leads WHERE id = ${id}`;
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/analytics");
}

function rowToLead(row: Record<string, unknown>): Lead {
  return {
    id: row.id as number,
    name: row.name as string,
    company: row.company as string,
    email: row.email as string,
    phone: row.phone as string,
    value: row.value as number,
    stage: row.stage as Lead["stage"],
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}
