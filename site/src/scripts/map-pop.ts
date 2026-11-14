// Hover, focus or tap a system on the services map to see a card explaining what it does.
// The cards are plain HTML next to the map (hidden without JS; the system cards below carry the same facts).
// Phones: build a vertical chain (hub, then six systems you tap open). The desktop SVG and cards stay in the page but are hidden by CSS.
function buildMobileMap(map: HTMLElement) {
  const esc = (s: string) => s.replace(/&(?!amp;|lt;|gt;)/g, '&amp;');
  const nodes = [...map.querySelectorAll<SVGGElement>('.m-node[data-pop]')];
  const wrap = document.createElement('div');
  wrap.className = 'kn-mmap';
  wrap.innerHTML = '<div class="kn-mmap__hub"><small>Your</small><b>Business</b><small>AI partner</small></div><ol class="kn-mmap__list"></ol>';
  const list = wrap.querySelector('ol')!;
  const opens: (() => void)[] = [];
  const btns: HTMLButtonElement[] = [];
  nodes.forEach((n, i) => {
    const texts = n.querySelectorAll('text');
    const cols = map.querySelector('#pop' + n.dataset.pop + ' .kn-pop__cols')!.cloneNode(true) as HTMLElement;
    const li = document.createElement('li');
    li.style.setProperty('--i', String(i));
    li.innerHTML = `<button type="button" class="kn-mmap__node" aria-expanded="false" aria-controls="mmp${i}"><span><b>${esc(texts[0]?.textContent ?? '')}</b><small>${esc(texts[1]?.textContent ?? '')}</small></span><i aria-hidden="true"></i></button><div class="kn-mmap__pop" id="mmp${i}" hidden></div>`;
    const pop = li.querySelector<HTMLElement>('.kn-mmap__pop')!;
    pop.append(cols);
    const btn = li.querySelector<HTMLButtonElement>('button')!;
    btns.push(btn);
    const set = (open: boolean) => { btn.setAttribute('aria-expanded', String(open)); pop.hidden = !open; };
    opens.push(() => set(true));
    btn.addEventListener('click', () => {
      const wasOpen = btn.getAttribute('aria-expanded') === 'true';
      btns.forEach((b) => { b.setAttribute('aria-expanded', 'false'); (document.getElementById(b.getAttribute('aria-controls')!) as HTMLElement).hidden = true; });
      set(!wasOpen);
    });
    list.append(li);
  });
  map.append(wrap);
  opens[0]?.();
}

export function initMapPop() {
  const map = document.querySelector<HTMLElement>('.kn-map');
  if (!map) return;
  buildMobileMap(map);
  const nodes = [...map.querySelectorAll<SVGGElement>('.m-node[data-pop]')];
  const pops = new Map(nodes.map((n) => [n, map.querySelector<HTMLElement>('#pop' + n.dataset.pop)!]));
  let active: SVGGElement | null = null;
  let lastType = 'mouse';

  const hide = () => {
    if (!active) return;
    pops.get(active)!.hidden = true;
    active.classList.remove('is-open');
    active = null;
  };
  const show = (n: SVGGElement) => {
    if (active === n) return;
    hide();
    const pop = pops.get(n)!;
    pop.hidden = false;
    n.classList.add('is-open');
    active = n;
    // Fit the card in the gap between the two node columns, so it never covers a neighbouring system.
    const m = map.getBoundingClientRect(), r = n.getBoundingClientRect();
    const gapL = Math.max(...nodes.filter((x) => +x.dataset.pop! < 3).map((x) => x.getBoundingClientRect().right));
    const gapR = Math.min(...nodes.filter((x) => +x.dataset.pop! >= 3).map((x) => x.getBoundingClientRect().left));
    const w = Math.max(300, Math.min(420, gapR - gapL - 24));
    pop.style.width = `${w}px`;
    const ph = pop.offsetHeight;
    const x = Math.max(0, Math.min((gapL + gapR) / 2 - m.left - w / 2, m.width - w));
    let y = r.top - m.top + r.height / 2 - ph / 2;
    y = Math.max(-8, Math.min(y, m.height - ph + 8));
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
  };

  nodes.forEach((n) => {
    n.addEventListener('pointerenter', (e) => { if ((e as PointerEvent).pointerType === 'mouse') show(n); });
    n.addEventListener('pointerleave', (e) => { if ((e as PointerEvent).pointerType === 'mouse' && document.activeElement !== n) hide(); });
    n.addEventListener('focus', () => show(n));
    n.addEventListener('blur', hide);
    n.addEventListener('pointerdown', (e) => { lastType = (e as PointerEvent).pointerType; });
    n.addEventListener('click', (e) => { e.stopPropagation(); if (lastType === 'mouse') return show(n); active === n ? hide() : show(n); });
    n.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hide(); } if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); active === n ? hide() : show(n); } });
  });
  document.addEventListener('click', hide);
}
