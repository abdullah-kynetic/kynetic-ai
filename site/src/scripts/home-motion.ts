// Motion for the home page. No libraries: CSS transitions plus one IntersectionObserver and one small canvas.
// Skipped entirely for visitors who ask for reduced motion.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function split(el: HTMLElement) {
  let i = 0;
  const walk = (node: Node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        (n.textContent ?? '').split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.append(' '); return; }
          const s = document.createElement('span');
          s.className = 'm-w'; s.style.setProperty('--wi', String(i++)); s.textContent = t;
          frag.append(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && (n as HTMLElement).tagName !== 'BR') walk(n);
    });
  };
  walk(el);
}

function reveals() {
  const root = document.documentElement;
  root.classList.add('m-on');
  const groups: [string, string][] = [
    ['.np-head > .np-badge, .np-why .np-badge, .np-head > p', ''],
    ['.np-why > div:first-child > p:not(.np-badge)', ''],
    ['.np-compare, .np-stat, .np-pillars li, .kn-map, .np-how__cta, .np-band__inner > p, .np-band__inner > a', ''],
  ];
  const seenParent = new Map<Element, number>();
  const marked: HTMLElement[] = [];
  groups.forEach(([sel]) => document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
    if (el.closest('.np-hero')) return;
    const p = el.parentElement!;
    const n = seenParent.get(p) ?? 0; seenParent.set(p, n + 1);
    el.dataset.m = ''; el.style.setProperty('--md', `${Math.min(n, 5) * 0.09}s`);
    marked.push(el);
  }));
  const heads = [...document.querySelectorAll<HTMLElement>('main h2')];
  heads.forEach((h) => split(h));
  const bars = [...document.querySelectorAll<HTMLElement>('.np-bars__fill')].map((b) => { const w = b.style.width; b.style.width = '0'; return { b, w }; });
  const counters = [...document.querySelectorAll<HTMLElement>('.np-compare__big strong')];
  const counted = counters.map((c) => ({ c, final: c.textContent ?? '' }));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target as HTMLElement;
      io.unobserve(el);
      el.classList.add('m-in');
      if ('m' in el.dataset) setTimeout(() => { el.removeAttribute('data-m'); el.classList.remove('m-in'); el.style.removeProperty('--md'); }, 1300);
      el.querySelectorAll('.np-bars__fill').forEach((f) => { const o = bars.find((x) => x.b === f); if (o) o.b.style.width = o.w; });
      const hit = counted.find((x) => el.contains(x.c));
      if (hit) countUp(hit.c, hit.final);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  marked.forEach((el) => io.observe(el));
  heads.forEach((h) => io.observe(h));
}

function countUp(el: HTMLElement, final: string) {
  const m = final.match(/^(\D*)([\d,]+)(.*)$/);
  if (!m) return;
  const target = Number(m[2].replace(/,/g, ''));
  const t0 = performance.now(), dur = 1400;
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = m[1] + Math.round(target * e).toLocaleString('en-US') + m[3];
    if (k < 1) requestAnimationFrame(step); else el.textContent = final;
  };
  el.textContent = m[1] + '0' + m[3];
  requestAnimationFrame(step);
}

function nav() {
  const bar = document.querySelector<HTMLElement>('.np-nav');
  if (!bar) return;
  const links = [...bar.querySelectorAll<HTMLAnchorElement>('.np-nav__links a')];
  const secs = links.map((a) => { const h = a.getAttribute('href') ?? ''; return h.startsWith('#') ? document.querySelector<HTMLElement>(h) : null; }).filter(Boolean) as HTMLElement[];
  let tick = false;
  const run = () => {
    tick = false;
    const y = scrollY;
    bar.classList.toggle('is-compact', y > 140);
    let cur = -1;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= 140) cur = i; });
    links.forEach((a, i) => a.classList.toggle('is-on', i === cur));
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
  run();
}

function buttons() {
  document.querySelectorAll<HTMLElement>('a.np-btn').forEach((b) => {
    if (b.children.length || !b.textContent) return;
    const t = b.textContent.trim();
    b.innerHTML = `<span class="np-btn__t"><span>${t}</span><span aria-hidden="true">${t}</span></span>`;
  });
}

function particles() {
  const host = document.querySelector<HTMLElement>('.np-hero--home');
  if (!host) return;
  const c = document.createElement('canvas');
  c.className = 'np-particles'; c.setAttribute('aria-hidden', 'true');
  host.prepend(c);
  const ctx = c.getContext('2d');
  if (!ctx) return;
  let w = 0, h = 0, raf = 0, on = true;
  const dots = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 1.2, vx: (Math.random() - .5) * .00006, vy: (Math.random() - .5) * .00006 }));
  const size = () => { const d = Math.min(devicePixelRatio || 1, 2); w = host.clientWidth; h = host.clientHeight; c.width = w * d; c.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#C9A96E';
    for (const p of dots) {
      p.x = (p.x + p.vx * 16 + 1) % 1; p.y = (p.y + p.vy * 16 + 1) % 1;
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.r, 0, 6.283); ctx.fill();
    }
    if (on) raf = requestAnimationFrame(draw);
  };
  size(); draw();
  addEventListener('resize', size, { passive: true });
  new IntersectionObserver(([e]) => { const v = e.isIntersecting; if (v && !on) { on = true; draw(); } else if (!v) { on = false; cancelAnimationFrame(raf); } }).observe(host);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { on = false; cancelAnimationFrame(raf); } else if (!on) { on = true; draw(); } });
}

export function initHomeMotion() {
  buttons();
  nav();
  if (reduced()) { document.querySelectorAll<SVGSVGElement>('.kn-map svg').forEach((s) => s.pauseAnimations?.()); return; }
  reveals();
  const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300));
  idle(particles);
}
