// The application overlay is a separate chunk: load it when the page is idle, or the moment
// someone reaches for a button (a click that beats the load waits for it, then opens as normal).
export function initAuditLazy() {
  let modal: Promise<void> | undefined;
  let ready = false;
  const load = () => (modal ??= import('./audit-modal').then((m) => { m.initAuditModal(); ready = true; }));
  const isAudit = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.('a[href*="cal.com/abdullah-kyneticai"], [data-audit-open]');
  const warm = (e: Event) => { if (isAudit(e.target)) load(); };
  document.addEventListener('pointerover', warm, { passive: true });
  document.addEventListener('focusin', warm);
  document.addEventListener('click', (e) => {
    if (ready || !isAudit(e.target)) return;
    e.preventDefault();
    const t = (e.target as HTMLElement).closest('a,button') as HTMLElement;
    load().then(() => t.click());
  }, true);
  ((window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 2500)))(load, { timeout: 4000 });
}
