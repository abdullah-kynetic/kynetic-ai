import { answerRate, conversionRate, getClientCalls } from "@/lib/mock";
import { CheckIcon, PhoneIcon, VoicemailIcon } from "@/components/icons";

function CallIcon({ type }: { type: string }) {
  if (type === "answered") return <PhoneIcon />;
  if (type === "booked") return <CheckIcon />;
  return <VoicemailIcon />;
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clientId = Number(id);
  const calls = getClientCalls(clientId);

  return (
    <div className="grid-3">
      <div className="card">
        <div className="card-head">
          <h3>Call log</h3>
          <span className="hint">Last 24 hours</span>
        </div>
        <div>
          {calls.map((c) => (
            <div key={c.id} className="call-item">
              <div className={`call-icon ${c.type}`}>
                <CallIcon type={c.type} />
              </div>
              <div className="call-body">
                <div className="call-top">
                  <strong>{c.who}</strong>
                  <time>{c.time}</time>
                </div>
                <div className="call-sub">{c.note}</div>
                {c.quote && <div className="call-quote">{c.quote}</div>}
              </div>
            </div>
          ))}
          {calls.length === 0 && <div className="empty-note">No calls logged yet.</div>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card kpi">
          <div className="top">
            <span className="label">Answer rate</span>
          </div>
          <div className="value">{answerRate(clientId)}%</div>
          <div className="foot">of all calls this period</div>
        </div>
        <div className="card kpi">
          <div className="top">
            <span className="label">Calls converted to booking</span>
          </div>
          <div className="value">{conversionRate(clientId)}%</div>
          <div className="foot">{calls.filter((c) => c.type === "booked").length} of {calls.length} calls</div>
        </div>
      </div>
    </div>
  );
}
