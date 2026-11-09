# Agency UI refinement

> Active completion checklist: [COMPLETION-PLAN.md](../codex/COMPLETION-PLAN.md); evidence index: [PROGRESS.md](../codex/PROGRESS.md). Historical code/deployment/test snapshot: [CURRENT_STATUS.md](../codex/CURRENT_STATUS.md). Latest Unslop validation is 527 unit tests and 3 browser workflows; the earlier 523 count below is the pre-Unslop run.

User request: apply Prompt Motion, Impeccable and Framer Motion ideas to improve the existing portal. Scope is the agency workspace on dev/codex-setup; no backend, provider, billing, authorization or deployment changes.

## Context and direction

This is an **Operate** surface for Abdullah and his verified admin cofounders: scan leads, record manual calls/DMs, review drafts, and inspect client operations. Preserve the established warm Kynetic identity in [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md): ivory/espresso/orange, self-hosted Cormorant display type and Inter for controls/data, accessible semantic colors, restrained borders, 44px controls. No gradients, invented metrics, decorative charts, page-load sequences, or new fonts.

The prior screens had unstyled native selects, tightly packed labels, stacked unrelated forms, no shared agency navigation, and no pending submission feedback. The refinement uses scoped agency CSS and shared presentation components; it does not restyle client pages or change server actions. An admin-only sidebar entry makes the workspace discoverable; VA navigation does not receive that entry and existing server guards remain authoritative.

- **Hierarchy:** real seven-day percentages and denominators; lead list before the lead-creation form; secondary alerts/settings below the daily work.
- **Layout:** inbox/history and manual DM logging in two columns; compose and recent drafts side by side; pricing and invoice creation paired. Stack at 900px; wrap all navigation links on mobile.
- **Controls:** consistent native form fields, explicit focus rings, readable statuses, safe long-value wrapping and stable-width pending buttons. Existing form names/action payloads remain intact.
- **States:** explanatory empty states, visible errors/saved feedback, disabled pending submissions, and explicit synthetic-workspace context. No live-availability claims inferred from styling.

## Motion thesis

- **Continuity:** the active navigation underline moves between routes using Motion shared layout. Current selection also has a static color and aria-current, so motion carries no exclusive information.
- **Feedback:** pending buttons disable duplicate submissions and replace their label with Saving/Checking/Working text. Preserve original label footprint to avoid layout shift. No spinner or infinite animation.
- **Budget:** 120ms feedback and 180ms navigation, existing Motion dependency only; no added dependency/lockfile, scroll listeners, entrance choreography or always-on effects. Server-rendered content is visible without JavaScript.
- **Reduced motion:** MotionConfig uses the user preference; shared-layout movement is omitted under reduced motion, feedback is instant, CSS transitions/animations are suppressed within the agency scope. Existing global theme/navigation behavior is retained.

## Free references used

- [Impeccable](https://github.com/pbakaus/impeccable), Apache 2.0: read the current SKILL and polish, animate, operate and craft-floor references. Applied the documented unavailable-launcher fallback using existing project context. No installer, background hooks, telemetry, generated agent files or live-edit overlay installed; .claude/skills and .github/ untouched.
- [Motion for React](https://motion.dev/), formerly Framer Motion, MIT: use the already installed motion/react package and its reduced-motion/shared-layout facilities. No paid Motion+ assets.
- [Tabler Icons](https://tabler.io/icons), MIT, and existing Base UI components: reuse the installed icon/control foundations.
- [Prompt Motion](https://prompt-motion.com/): requested reference, but fetching it returned HTTP 403 under this environment's network policy. Its content was not available for inspection and no snippets are claimed to be copied from it.

## Verification and remaining scope

Compare actual local browser renders at desktop/mobile sizes, light/dark themes, keyboard navigation and reduced motion. The agency end-to-end flow also verifies authenticated no-JavaScript rendering and no horizontal overflow. Retain existing consent, kill-switch, auth, campaign and billing tests; UI polish does not authorize live sends, Stripe, workflow activation, Twenty writes or production changes.

No DEV/VPS deploy is performed by this work. Browser evidence uses disposable local synthetic databases and signed synthetic sessions. New code needs the usual separately requested Mac DEV handoff before it appears at dev.kyneticai.com.

## Local visual evidence and checks — 2026-11-05

Synthetic-only browser captures: [original inbox](previews/inbox-before.png), [updated desktop inbox](previews/inbox-desktop.png), [updated mobile inbox](previews/inbox-mobile.png), and [dark mobile compose](previews/compose-dark-mobile.png). Screenshots are evidence of local behavior, not deployed DEV observations.

Verified typecheck/build/lint, 523 unit tests, 13 agency step checks (two separately gated live checks skipped), and three browser flows. Five light mobile accessibility scans and one dark/reduced-motion scan have zero violations. Keyboard activation/current navigation state, no horizontal overflow at 390px, and authenticated no-JavaScript content all pass.

## Follow-up Unslop pass

Applied [Unslop by Damir Sokolovsky / @heydamir](https://github.com/heydamir/unslop), CC BY 4.0, as targeted polish of the existing direction. See [the audit, nine passes and verification](UNSLOP-REVIEW.md). New previews cover neutral source counts, quieter campaign rows and human-readable billing/date labels; the brand and section order are retained.
