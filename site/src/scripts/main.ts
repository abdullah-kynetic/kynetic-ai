// Motion layer for kyneticai.com. The markup already carries each element's starting state in
// its inline style (opacity/transform); this script plays the transitions that Framer's runtime
// used to. All numbers come from the published site's bundle, see docs/MOTION-SPEC.md.
import { initAppear } from './appear';
import { initScrollIn } from './scroll-in';
import { initWordReveal } from './word-reveal';
import { initParticles } from './particles';
import { initTicker } from './ticker';
import { initButtons } from './buttons';
import { initNav } from './nav';
import { initLeakCalc } from './leak-calc';
import { initForm } from './form';
import { initLoops, initCodeLoop } from './loops';
import { initReveal } from './reveal';
import { initAuditModal } from './audit-modal';

const start = () => {
  initAppear();
  initScrollIn();
  initWordReveal();
  initParticles();
  initTicker();
  initButtons();
  initNav();
  initLeakCalc();
  initForm();
  initLoops();
  initCodeLoop();
  initReveal();
  initAuditModal();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
