import Link from "next/link";
import { CLIENTS } from "@/lib/mock";
import StatusPill from "@/components/StatusPill";

export default function ClientsPage() {
  const live = CLIENTS.filter((c) => c.statusLabel === "Live").length;
  const onboarding = CLIENTS.filter((c) => c.statusLabel === "Onboarding").length;
  const paused = CLIENTS.filter((c) => c.statusLabel === "Paused").length;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Clients</h1>
          <div className="sub">Every account running on the Speed-to-Lead system</div>
        </div>
        <div className="top-actions">
          <button className="btn primary">+ New client</button>
        </div>
      </div>

      <section className="view">
        <div className="filters">
          <button className="chip active">All ({CLIENTS.length})</button>
          <button className="chip">Live ({live})</button>
          <button className="chip">Onboarding ({onboarding})</button>
          <button className="chip">Paused ({paused})</button>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Trade</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th>Calls / mo</th>
                  <th>Recovered</th>
                  <th>Since</th>
                </tr>
              </thead>
              <tbody>
                {CLIENTS.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} className="name-cell">
                        <div className="initials">{c.initials}</div>
                        <div className="who">
                          <strong>{c.name}</strong>
                          <span>Since {c.since}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="ink-dim">{c.trade}</td>
                    <td><StatusPill status={c.status} label={c.statusLabel} /></td>
                    <td className="ink-dim">{c.plan}</td>
                    <td className="mono">{c.calls}</td>
                    <td className="amt">{c.recovered}</td>
                    <td className="ink-faint">{c.since}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
