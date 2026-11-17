import { leaveViewAs } from '@/server/impersonation/leave';

export const dynamic = 'force-dynamic';

// A GET on purpose: the proxy refuses every write while a view-as session is open, and ending the
// read-only view is harmless to repeat.
export async function GET(request: Request) {
  return leaveViewAs(request.headers, 'expired');
}
