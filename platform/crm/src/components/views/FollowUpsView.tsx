import { getFollowUps } from "@/lib/queries";
import { FOLLOWUP_STAGES, formatDate } from "@/lib/types";

export default async function FollowUpsView({ clientId }: { clientId: number }) {
  const followups = await getFollowUps(clientId);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {FOLLOWUP_STAGES.map((stage) => {
        const inStage = followups.filter((f) => f.stage === stage.key);
        return (
          <div key={stage.key} className="flex w-56 shrink-0 flex-col rounded-xl border border-border bg-surface-muted">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-medium">{stage.label}</span>
              <span className="text-xs text-muted">{inStage.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              {inStage.map((f) => (
                <div key={f.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="text-sm font-medium">{f.name}</div>
                  <div className="text-xs text-muted">{f.phone}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted">
                    <span className="capitalize">{f.source}</span>
                    <span>{formatDate(f.lastContactAt)}</span>
                  </div>
                </div>
              ))}
              {inStage.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted">Empty</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
