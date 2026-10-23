// Hero star field. The original is the Framer "Particles Background" component (tsParticles):
// 30 champagne circles, 1 to 2px, constant opacity 1, speed 1, no links, no hover/click interaction,
// wrapper opacity 0.3 (already in the markup).
import { tsParticles } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';

export async function initParticles() {
  const host = document.querySelector<HTMLElement>('#One');
  if (!host) return;
  host.querySelector('canvas')?.remove(); // placeholder canvas from the static markup
  await loadSlim(tsParticles);
  await tsParticles.load({
    id: 'One',
    element: host,
    options: {
      fpsLimit: 60,
      detectRetina: true,
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      interactivity: { events: { onClick: { enable: false }, onHover: { enable: false } } },
      particles: {
        number: { value: 30, density: { enable: false } },
        color: { value: 'rgb(138, 106, 47)' },
        shape: { type: 'circle' },
        opacity: { value: 1 },
        size: { value: { min: 1, max: 2 } },
        links: { enable: false },
        collisions: { enable: false },
        move: { enable: true, speed: 1, direction: 'none', random: false, straight: false, outModes: { default: 'out' } },
      },
    },
  });
}
