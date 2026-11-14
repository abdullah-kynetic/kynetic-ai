// Pre-call qualifier: a few short answers, then the shared Cal booking page opens with the answers
// pre-filled into the booking notes. Nothing is stored by this site. No Cal account settings are touched.
export function initQualifier() {
  document.querySelectorAll<HTMLFormElement>('form[data-qualifier]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value || '').trim();
      const notes = [
        `Company: ${v('company')}`,
        `Monthly revenue: ${v('revenue')}`,
        `New leads a month: ${v('leads')}`,
        `Where leads slip: ${v('slip')}`,
      ].join('\n');
      const url = new URL(form.action);
      url.searchParams.set('notes', notes);
      window.location.href = url.toString();
    });
  });
}
