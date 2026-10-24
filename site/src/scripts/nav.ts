// Top navigation: link hover chip, scroll-spy highlight, smooth anchor scrolling and the mobile menu.
// Nav links (framer-520aC): background fades to the alt surface (#f2eee8) on hover/selected, spring 300/50.
// Desktop pill (framer-FbUpk): collapses to a compact pill (mark, links, icon button) once the page
// has scrolled past the hero (or one viewport), and expands again 80px above that line. Measured on the published site:
// variant Desktop -> Process (framer-v-vc9era), pill 1200 -> 495px, ~0.6s spring ease-out, same motion both ways.
// Mobile bar (framer-FbUpk): closed 64px -> open (menu height) spring 500/60, hamburger lines cross.
import { animate } from 'motion';
import { reducedMotion } from './appear';

const CHIP_ON = 'rgb(242, 238, 232)';
const CHIP_OFF = 'rgba(242, 238, 232, 0)';
const CHIP = { type: 'spring', stiffness: 300, damping: 50, mass: 1 } as const;
const PILL = { type: 'spring', stiffness: 220, damping: 30, mass: 1 } as const;
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

function initCollapse() {
  const nav = document.querySelector<HTMLElement>('nav[data-framer-name="Desktop"]');
  const pill = nav?.querySelector<HTMLElement>('.framer-1eavvn1');
  const logo = nav?.querySelector<HTMLElement>('.framer-iz97ye');
  const word = logo?.querySelector<HTMLElement>('img[alt="Kynetic AI"]');
  const mark = logo?.querySelector<HTMLElement>('.kn-nav-mark');
  const labels = [...(nav?.querySelectorAll<HTMLElement>('.framer-17m08j9, .framer-xo714e') ?? [])];
  if (!nav || !pill || !logo || !word || !mark || !labels.length) return;
  const FULL = 'framer-v-1t6bwo0', COMPACT = 'framer-v-vc9era';
  const hero = document.getElementById('hero');
  const HYSTERESIS = 80;
  const MARK = 28;
  const morphing = [pill, word, mark, ...labels];
  let compact = false;
  let progress = 0; // 0 = full pill, 1 = compact pill
  let running: { stop: () => void } | null = null;
  const m = { full: 0, compact: 0, word: 0, label: 0, logoGap: 0, labelGap: 0 };

  const setState = (next: boolean) => {
    nav.classList.remove(FULL, COMPACT);
    nav.classList.add(next ? COMPACT : FULL);
    nav.classList.toggle('kn-nav-compact', next);
    nav.dataset.framerName = next ? 'Process' : 'Desktop';
    pill.dataset.framerName = nav.dataset.framerName;
  };
  const clear = () => {
    for (const e of morphing) for (const k of ['flex', 'width', 'opacity', 'margin-right']) e.style.removeProperty(k);
    word.style.width = 'auto'; // the markup's own inline value
    nav.classList.remove('kn-nav-morph');
  };

  // The expanded pill is `flex: 1 0 0` (flex-basis 0), so an animated `width` is ignored there and the pill snapped
  // open. The morph is driven by one progress value p (0 full .. 1 compact) that sets flex:none plus an explicit pill
  // width and the width/opacity of the wordmark, K mark and button label together. Both directions are the same
  // animation, and a reversal just continues from the current p.
  const measure = () => {
    clear();
    const was = compact;
    setState(false);
    m.full = pill.getBoundingClientRect().width;
    nav.classList.add('kn-nav-morph');
    m.word = word.getBoundingClientRect().width;
    m.label = labels[0].getBoundingClientRect().width;
    m.logoGap = parseFloat(getComputedStyle(logo).columnGap) || 0;
    m.labelGap = parseFloat(getComputedStyle(labels[0].parentElement!).columnGap) || 0;
    nav.classList.remove('kn-nav-morph');
    setState(true);
    m.compact = pill.getBoundingClientRect().width;
    setState(was);
  };
  const paint = (p: number) => {
    progress = p;
    pill.style.flex = 'none';
    pill.style.width = `${m.full + (m.compact - m.full) * p}px`;
    word.style.width = `${m.word * (1 - p)}px`;
    word.style.opacity = String(1 - p);
    word.style.marginRight = `${-m.logoGap * p}px`;
    mark.style.width = `${MARK * p}px`;
    mark.style.opacity = String(p);
    for (const l of labels) {
      l.style.width = `${m.label * (1 - p)}px`;
      l.style.opacity = String(1 - p);
      l.style.marginRight = `${-m.labelGap * p}px`;
    }
  };

  const go = (next: boolean, instant = false) => {
    if (next === compact && !instant) return;
    compact = next;
    running?.stop();
    running = null;
    if (instant || reducedMotion()) {
      clear();
      setState(next);
      progress = next ? 1 : 0;
      return;
    }
    if (!nav.classList.contains('kn-nav-morph')) {
      measure();
      setState(false); // full layout for the whole morph, so the content spreads continuously
      nav.classList.add('kn-nav-morph');
      paint(progress);
    }
    running = animate(progress, next ? 1 : 0, {
      ...PILL,
      onUpdate: paint,
      onComplete: () => {
        running = null;
        clear();
        setState(next);
      },
    });
  };

  // Collapse once scrollY passes the end of the hero (or one viewport, whichever is first); expand again 80px above
  // that line so a small scroll jitter around it can't flicker.
  const threshold = () => Math.min(innerHeight, hero ? hero.getBoundingClientRect().bottom + scrollY : innerHeight);
  const decide = () => {
    const y = scrollY, t = threshold();
    if (!compact && y > t) go(true);
    else if (compact && y < t - HYSTERESIS) go(false);
  };
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; decide(); });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  if (scrollY > threshold()) go(true, true);
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
  initCollapse();
  initAnchors();
  initMobileMenu();
}
