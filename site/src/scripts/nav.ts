// Top navigation: link hover chip, scroll-spy highlight, smooth anchor scrolling and the mobile menu.
// Nav links (framer-520aC): background fades to 18% orange on hover/selected, spring 300/50.
// Mobile bar (framer-FbUpk): closed 64px -> open (menu height) spring 500/60, hamburger lines cross.
import { animate } from 'motion';
import { reducedMotion } from './appear';

const CHIP_ON = 'rgba(217, 102, 42, 0.18)';
const CHIP_OFF = 'rgba(0, 0, 0, 0)';
const CHIP = { type: 'spring', stiffness: 300, damping: 50, mass: 1 } as const;
const BAR = { type: 'spring', stiffness: 500, damping: 60, mass: 1 } as const;

// Scroll-spy: a link is selected from the moment its section top passes this line.
const SPY: Record<string, string> = { process: 'Process', plans: 'Plans', contact: 'Contact' };
const SPY_OFFSET = 0; // measured live: the link switches exactly when the section top reaches the viewport top

function initLinks() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('nav a.framer-520aC')];
  const selected = new Set<HTMLAnchorElement>();
  const hovered = new Set<HTMLAnchorElement>();
  const paint = (a: HTMLAnchorElement) => {
    const on = selected.has(a) || hovered.has(a);
    if (reducedMotion()) a.style.backgroundColor = on ? CHIP_ON : CHIP_OFF;
    else animate(a, { backgroundColor: on ? CHIP_ON : CHIP_OFF }, CHIP);
  };
  links.forEach((a) => {
    a.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovered.add(a); paint(a); } });
    a.addEventListener('pointerleave', () => { hovered.delete(a); paint(a); });
  });

  const sections = Object.entries(SPY)
    .map(([id, label]) => ({ el: document.getElementById(id), label }))
    .filter((s): s is { el: HTMLElement; label: string } => !!s.el);
  const spy = () => {
    let current = '';
    for (const s of sections) if (s.el.getBoundingClientRect().top <= SPY_OFFSET) current = s.label;
    links.forEach((a) => {
      const want = !!current && a.textContent!.trim() === current;
      if (want !== selected.has(a)) {
        want ? selected.add(a) : selected.delete(a);
        paint(a);
      }
    });
  };
  addEventListener('scroll', spy, { passive: true });
  spy();
}

function scrollToHash(hash: string) {
  const el = hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
  if (!el) return false;
  el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  history.pushState(null, '', hash);
  return true;
}

function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname) return;
    // same-page links scroll smoothly, no jump
    e.preventDefault();
    if (url.hash) scrollToHash(url.hash);
    else scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
}

function initMobileMenu() {
  const nav = document.querySelector<HTMLElement>('nav[data-framer-name="Mobileclosed"]');
  if (!nav) return;
  const ham = nav.querySelector<HTMLElement>('.framer-cwn08')!;
  const [l3, l2, l1] = ['line3', 'line2', 'line 1'].map((n) => ham.querySelector<HTMLElement>(`[data-framer-name="${n}"]`)!);
  const CLOSED_NAV = 'framer-v-1plx7ua', OPEN_NAV = 'framer-v-1tid13i';
  const CLOSED_HAM = 'framer-v-1h2g8fh', OPEN_HAM = 'framer-v-ecum8m';
  const closedStyle = nav.getAttribute('style') || '';
  let open = false;

  const set = (next: boolean) => {
    if (next === open) return;
    open = next;
    const from = nav.getBoundingClientRect().height;
    nav.style.height = `${from}px`;
    nav.classList.replace(open ? CLOSED_NAV : OPEN_NAV, open ? OPEN_NAV : CLOSED_NAV);
    nav.dataset.framerName = open ? 'Mobile open' : 'Mobileclosed';
    ham.classList.replace(open ? CLOSED_HAM : OPEN_HAM, open ? OPEN_HAM : CLOSED_HAM);
    ham.dataset.framerName = open ? 'open' : 'closed';
    if (open) nav.style.cssText = nav.style.cssText.replace(/--border-[a-z-]+:[^;]+;?/g, '') + '--border-bottom-width:0px;--border-left-width:0px;--border-right-width:0px;--border-top-width:0px;--border-color:rgba(0,0,0,0);';
    else nav.setAttribute('style', closedStyle);
    nav.style.height = '';
    const to = nav.getBoundingClientRect().height;
    l2.style.display = open ? 'none' : '';
    if (reducedMotion()) return;
    const d = 9;
    animate(nav, { height: [`${from}px`, `${to}px`] }, BAR).then(() => (nav.style.height = ''));
    const on = open;
    animate(l3, on ? { y: [-d, 0], rotate: [0, 45] } : { y: [d, 0], rotate: [45, 0] }, BAR);
    animate(l1, on ? { y: [d, 0], rotate: [0, -45] } : { y: [-d, 0], rotate: [-45, 0] }, BAR);
  };

  ham.addEventListener('click', () => set(!open));
  nav.querySelector('.framer-1jkrvas')?.addEventListener('click', () => set(false));
  nav.querySelectorAll('.framer-1mmfnwb a').forEach((a) => a.addEventListener('click', () => set(false)));
}

export function initNav() {
  initLinks();
  initAnchors();
  initMobileMenu();
}
