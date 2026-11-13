// Same visibility rule as the original runtime: an element counts as "in view" when it intersects the
// viewport and the visible height is at least `threshold` of min(element height, viewport height).
// (Plain IntersectionObserver ratios never reach 0.5 for elements taller than the screen.)
const STEPS = Array.from({ length: 100 }, (_, i) => i * 0.01);

export function watchInView(
  el: Element,
  threshold: number,
  onEnter: () => void,
  onLeave?: () => void,
) {
  let inside = false;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const h = e.boundingClientRect.height;
        const ok = h === 0 ? e.isIntersecting : e.isIntersecting && e.intersectionRect.height / Math.min(h, window.innerHeight) >= threshold;
        if (ok && !inside) { inside = true; onEnter(); }
        else if (!ok && inside) { inside = false; onLeave?.(); }
      }
    },
    { threshold: STEPS },
  );
  io.observe(el);
  return () => io.disconnect();
}
