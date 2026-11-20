// Workspace switcher model (admin shell). Pure functions only, so the search and keyboard rules are
// unit-tested without a browser. The list comes from the same admin_tenant_overview() the Clients
// page uses; nothing here invents fields. Tenants carry no city, state or industry today, so the
// second line is the plan and the portal status.

export type WorkspaceSource = {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
};

export type Workspace = {
  id: string;
  name: string;
  /** Second line under the name. */
  detail: string;
  /** False while the client portal is still being built: "View as client" is disabled. */
  canView: boolean;
};

const PLAN_LABELS: Record<string, string> = { lite: 'Lite', full: 'Full' };

export function planLabel(plan: string): string {
  return PLAN_LABELS[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
}

/** Same rule as the Clients page: active clients and the seeded clients can be opened as the client. */
export function portalState(status: string, isDemo: boolean): { label: string; canView: boolean } {
  if (status === 'active') return { label: 'Ready', canView: true };
  if (status === 'onboarding' && isDemo) return { label: 'Ready', canView: true };
  if (status === 'onboarding') return { label: 'Building', canView: false };
  return { label: 'Suspended', canView: false };
}

export function toWorkspaces(
  rows: readonly WorkspaceSource[],
  opts: { demoSlugs: ReadonlySet<string>; hiddenSlugs?: ReadonlySet<string> }
): Workspace[] {
  return rows
    .filter((r) => r.status !== 'offboarded' && !opts.hiddenSlugs?.has(r.slug))
    .map((r) => {
      const state = portalState(r.status, opts.demoSlugs.has(r.slug));
      return {
        id: r.tenantId,
        name: r.name,
        detail: `${planLabel(r.plan)} plan · ${state.label}`,
        canView: state.canView
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive match on name or detail. Blank query returns everything. */
export function filterWorkspaces(list: readonly Workspace[], query: string): Workspace[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...list];
  return list.filter((w) => `${w.name} ${w.detail}`.toLowerCase().includes(q));
}

/** One or two initials for the logo tile. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'K';
  const letters = words.length === 1 ? words[0]!.slice(0, 2) : words[0]![0]! + words[1]![0]!;
  return letters.toUpperCase();
}

/** Up/down move with wrap-around; -1 means nothing active yet. */
export function moveActive(current: number, count: number, key: 'ArrowDown' | 'ArrowUp'): number {
  if (count <= 0) return -1;
  if (key === 'ArrowDown') return current < 0 || current >= count - 1 ? 0 : current + 1;
  return current <= 0 ? count - 1 : current - 1;
}

/** Only an in-app admin path is a valid place to return to after "View as client". */
export function safeAdminReturn(value: unknown): string {
  if (typeof value !== 'string') return '/admin';
  if (!value.startsWith('/admin') || value.startsWith('//') || value.includes('\\'))
    return '/admin';
  if (value.length > 300 || /[\r\n]/.test(value)) return '/admin';
  return value;
}
