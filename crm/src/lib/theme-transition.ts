/**
 * Animate a theme change as a circular reveal that expands from the toggle
 * button, using the View Transitions API. The new theme sweeps across the
 * screen to the farthest corner. Falls back to an instant change where the API
 * is unavailable or the user prefers reduced motion.
 */
export type ThemeTransitionOrigin = { x: number; y: number };

const DURATION_MS = 500;
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** Centre of an element, used as the reveal origin. */
export function originFromElement(
  el: Element | null | undefined
): ThemeTransitionOrigin | undefined {
  if (!el) return undefined;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function startThemeTransition(apply: () => void, origin?: ThemeTransitionOrigin) {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!document.startViewTransition || reduceMotion) {
    apply();
    return;
  }

  // Keyboard shortcut has no button position: reveal from the top-right,
  // where the toggle sits in the header.
  const x = origin?.x ?? window.innerWidth - 48;
  const y = origin?.y ?? 32;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  root.style.setProperty('--x', `${x}px`);
  root.style.setProperty('--y', `${y}px`);
  root.classList.add('theme-transitioning');

  const transition = document.startViewTransition(apply);
  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
        },
        {
          duration: DURATION_MS,
          easing: EASING,
          pseudoElement: '::view-transition-new(root)'
        }
      );
    })
    .catch(() => {});
  transition.finished.finally(() => root.classList.remove('theme-transitioning'));
}
