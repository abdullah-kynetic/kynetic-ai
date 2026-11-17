'use client';

import { useEffect } from 'react';

/**
 * Sends the admin back at the hard end of the session, even if they never click anything. The delay
 * is the server's remaining time (not a client clock), plus a second so the server agrees it ended.
 */
export function ExpiryRedirect({ msRemaining }: { msRemaining: number }) {
  useEffect(() => {
    const id = window.setTimeout(
      () => window.location.assign('/view-as/expired'),
      Math.max(0, msRemaining) + 1000
    );
    return () => window.clearTimeout(id);
  }, [msRemaining]);
  return null;
}
