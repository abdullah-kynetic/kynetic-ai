import { getClient } from "@/lib/queries";
import StatCard from "@/components/StatCard";

export default async function ReviewsView({ clientId }: { clientId: number }) {
  const client = await getClient(clientId);
  if (!client) return <p className="text-sm text-muted">Client not found.</p>;

  const responseRate = client.reviewsRequested > 0
    ? Math.round((client.reviewsReceived / client.reviewsRequested) * 100)
    : 0;
  const delta = (client.googleRatingNow - client.googleRatingBefore).toFixed(1);

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reviews requested" value={String(client.reviewsRequested)} />
        <StatCard label="Reviews received" value={String(client.reviewsReceived)} hint={`${responseRate}% response rate`} />
        <StatCard label="Google rating now" value={client.googleRatingNow.toFixed(1)} />
        <StatCard label="Change since signup" value={`${Number(delta) >= 0 ? "+" : ""}${delta}`} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-4 text-sm font-medium">Before &amp; after</h2>
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs text-muted">Before Kynetic</div>
            <div className="text-3xl font-semibold text-muted">{client.googleRatingBefore.toFixed(1)}</div>
          </div>
          <div className="text-2xl text-muted">→</div>
          <div>
            <div className="text-xs text-muted">Now</div>
            <div className="text-3xl font-semibold text-accent">{client.googleRatingNow.toFixed(1)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
