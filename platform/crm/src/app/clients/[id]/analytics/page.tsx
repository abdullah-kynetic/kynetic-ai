import { answerRate, conversionRate, getClient, getClientBookings, getClientCalls } from "@/lib/mock";
import CallsTrendChart from "@/components/CallsTrendChart";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const client = getClient(clientId);
  const calls = getClientCalls(clientId);
  const bookings = getClientBookings(clientId);
  const missed = calls.filter((c) => c.type === "missed").length;

  if (!client) return null;

  const kpis = [
    { label: "Calls handled", value: String(calls.length), foot: "Last 24 hours" },
    { label: "Answer rate", value: `${answerRate(clientId)}%`, foot: "vs. industry avg ~65%" },
    { label: "Jobs booked", value: String(bookings.length), foot: `${conversionRate(clientId)}% of calls` },
    { label: "Revenue recovered", value: client.recovered, foot: "Est. from missed-call recovery" },
  ];

  return (
    <>
      <div className="grid-4">
        {kpis.map((k) => (
          <div key={k.label} className="card kpi">
            <div className="top"><span className="label">{k.label}</span></div>
            <div className="value">{k.value}</div>
            <div className="foot">{k.foot}</div>
          </div>
        ))}
      </div>

      <div className="section-title">Calls answered vs. missed — before &amp; after Kynetic</div>
      <div className="card card-pad">
        <CallsTrendChart afterRate={answerRate(clientId)} />
      </div>

      <div className="grid-3" style={{ marginTop: 14 }}>
        <div className="card card-pad">
          <div style={{ fontSize: 11.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>
            Missed-call jobs saved
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-jetbrains-mono)" }}>{missed}</div>
          <div className="ink-faint" style={{ fontSize: 11.5 }}>Calls that would&apos;ve gone to voicemail without Kynetic</div>
        </div>
        <div className="card card-pad">
          <div style={{ fontSize: 11.5, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: ".05em" }}>
            Plan
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{client.plan}</div>
          <div className="ink-faint" style={{ fontSize: 11.5 }}>Client since {client.since}</div>
        </div>
      </div>
    </>
  );
}
