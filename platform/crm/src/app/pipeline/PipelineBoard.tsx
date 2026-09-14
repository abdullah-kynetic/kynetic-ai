"use client";

import { useState, useTransition } from "react";
import { updateLeadStage } from "@/lib/actions";
import { formatCurrency, STAGES, type Lead } from "@/lib/leads";

export default function PipelineBoard({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [dragId, setDragId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  function moveLead(id: number, stage: Lead["stage"]) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage } : l)));
    startTransition(() => updateLeadStage(id, stage));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted">Drag a card to move it to a new stage.</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((l) => l.stage === stage.key);
          const total = stageLeads.reduce((sum, l) => sum + l.value, 0);

          return (
            <div
              key={stage.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId != null && moveLead(dragId, stage.key)}
              className="flex w-64 shrink-0 flex-col rounded-xl border border-border bg-surface-muted"
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                  <span className="text-sm font-medium">{stage.label}</span>
                </div>
                <span className="text-xs text-muted">{stageLeads.length}</span>
              </div>
              <div className="px-3 py-2 text-xs text-muted">{formatCurrency(total)}</div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => setDragId(null)}
                    className="cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm active:cursor-grabbing"
                  >
                    <div className="text-sm font-medium">{lead.name}</div>
                    <div className="text-xs text-muted">{lead.company}</div>
                    <div className="mt-2 text-xs font-medium" style={{ color: stage.color }}>
                      {formatCurrency(lead.value)}
                    </div>
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
