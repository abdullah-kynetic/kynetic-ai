// Worked lost-revenue example: missed leads a month x close rate x average job. Example inputs only.
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

export function initLeakCalc() {
  document.querySelectorAll<HTMLElement>('[data-leak-calc]').forEach((root) => {
    const val = (k: string) => Math.max(0, Number(root.querySelector<HTMLInputElement>(`[data-leak="${k}"]`)?.value) || 0);
    const out = root.querySelector<HTMLElement>('[data-leak-out]');
    const update = () => {
      const rate = Math.min(100, val('rate'));
      if (out) out.textContent = fmt(val('leads') * (rate / 100) * val('job'));
    };
    root.addEventListener('input', update);
    update();
  });
}
