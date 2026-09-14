"use client";

import { useState, useTransition } from "react";
import { createLead, deleteLead, updateLeadStage } from "@/lib/actions";
import { formatCurrency, STAGES, stageMeta, type Lead } from "@/lib/leads";

export default function LeadsView({ leads }: { leads: Lead[] }) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted">{leads.length} total</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          {showForm ? "Cancel" : "+ New lead"}
        </button>
      </div>

      {showForm && (
        <form
          action={(formData) => {
            startTransition(async () => {
              await createLead(formData);
              setShowForm(false);
            });
          }}
          className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input name="name" required placeholder="Full name" className="input" />
          <input name="company" required placeholder="Company" className="input" />
          <input name="email" required type="email" placeholder="Email" className="input" />
          <input name="phone" placeholder="Phone" className="input" />
          <input name="value" type="number" min={0} placeholder="Deal value ($)" className="input" />
          <select name="stage" defaultValue="new" className="input">
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Add lead"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium">{lead.name}</td>
                <td className="px-4 py-3 text-muted">{lead.company}</td>
                <td className="px-4 py-3 text-muted">{lead.email}</td>
                <td className="px-4 py-3">{formatCurrency(lead.value)}</td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={lead.stage}
                    onChange={(e) => startTransition(() => updateLeadStage(lead.id, e.target.value))}
                    className="rounded-md border border-border bg-transparent px-2 py-1 text-xs"
                    style={{ color: stageMeta(lead.stage).color }}
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startTransition(() => deleteLead(lead.id))}
                    className="text-xs text-muted hover:text-red-500"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No leads yet — add your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
