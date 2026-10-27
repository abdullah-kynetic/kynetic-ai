'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type ViewAsInfo = { tenantName: string; readOnly: boolean } | null;

const ViewAsContext = createContext<ViewAsInfo>(null);

/**
 * Tells client components that a Kynetic user is viewing as the client. Write controls read
 * `useViewAsReadOnly()` to render disabled with an explanation (DESIGN_SYSTEM View-as banner). This is
 * display only: the database and the server actions are what refuse the write (SECURITY 2.6).
 */
export function ViewAsProvider({ value, children }: { value: ViewAsInfo; children: ReactNode }) {
  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAsReadOnly(): { readOnly: boolean; reason: string | null } {
  const v = useContext(ViewAsContext);
  return v?.readOnly
    ? { readOnly: true, reason: `Read-only while viewing ${v.tenantName} as the client.` }
    : { readOnly: false, reason: null };
}
