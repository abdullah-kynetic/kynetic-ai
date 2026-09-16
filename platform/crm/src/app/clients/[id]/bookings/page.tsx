import { getClientBookings } from "@/lib/mock";
import StatusPill from "@/components/StatusPill";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookings = getClientBookings(Number(id));
  const upcoming = bookings.filter((b) => b.statusLabel !== "Needs reschedule");

  return (
    <>
      <div className="filters">
        <button className="chip active">Upcoming ({upcoming.length})</button>
        <button className="chip">Completed (0)</button>
        <button className="chip">Cancelled (0)</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Type</th>
                <th>Scheduled</th>
                <th>Tech</th>
                <th>Est. value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td><strong>{b.job}</strong></td>
                  <td className="ink-dim">{b.type}</td>
                  <td className="mono">{b.when}</td>
                  <td className="ink-dim">{b.tech}</td>
                  <td className="amt">{b.value}</td>
                  <td><StatusPill status={b.status} label={b.statusLabel} /></td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan={6} className="empty-note">No bookings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
