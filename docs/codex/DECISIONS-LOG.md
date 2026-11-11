
## Lane A, 2026-11-11 — A0 (F-01, F-49, F-63)

- Current user instructions authorize squash merges after both CI jobs pass, superseding the historical no-squash/ask-before-merge repository text. Deploy remains a separate Bob handoff only when Abdullah says deploy.
- Use a separate Git worktree for Lane A so simultaneous sessions do not change each other's checkout or index.
- Funnel won counts use deals won in the selected range with the same Alex call/booking attribution as won revenue. `metrics_daily` has no won-count column; no migration added.
- Canonical report artifact key is derived from the authenticated tenant and report period, never trusted from a stored arbitrary key. Missing object or unconfigured storage uses the labelled read-only metrics fallback. Invalid objects and provider failures surface the retry state.
- Existing artifacts retain their stored performance/revenue totals; absent new sections are computed and labelled. Future artifacts include reached, won, daily trend and guarantee result. Guarantee evaluation excludes bookings created after the report month.
- Platform is always enabled by the existing module contract, so an A0 platform-off 403 test is not applicable. Addon module-off checks begin in A1.
