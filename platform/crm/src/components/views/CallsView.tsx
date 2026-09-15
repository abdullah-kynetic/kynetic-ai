import { getBookings, getCalls } from "@/lib/queries";
import { formatDateTime } from "@/lib/types";

const OUTCOME_LABEL: Record<string, string> = {
  booked: "Booked",
  missed_call_saved: "Missed call saved",
  inquiry: "Inquiry",
  voicemail: "Voicemail",
};

const OUTCOME_COLOR: Record<string, string> = {
  booked: "#5ed67e",
  missed_call_saved: "#5eb8ff",
  inquiry: "#7c9cff",
  voicemail: "#9497b8",
};

export default async function CallsView({ clientId }: { clientId: number }) {
  const [calls, bookings] = await Promise.all([getCalls(clientId), getBookings(clientId)]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 text-sm font-medium">Call log</h2>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium">Caller</th>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <div className="font-medium">{call.callerName}</div>
                    <div className="text-xs text-muted">{call.callerPhone}</div>
                  </td>
                  <td className="px-4 py-2 text-muted">{formatDateTime(call.occurredAt)}</td>
                  <td className="px-4 py-2">
                    <span className="text-xs font-medium" style={{ color: OUTCOME_COLOR[call.outcome] }}>
                      {OUTCOME_LABEL[call.outcome]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 text-sm font-medium">Upcoming bookings</h2>
        <div className="flex flex-col gap-2 p-4">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-lg border border-border p-3">
              <div className="text-sm font-medium">{booking.customerName}</div>
              <div className="text-xs text-muted">{booking.service}</div>
              <div className="mt-1 text-xs text-accent">{formatDateTime(booking.scheduledAt)}</div>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-sm text-muted">No upcoming bookings.</p>}
        </div>
      </div>
    </div>
  );
}
