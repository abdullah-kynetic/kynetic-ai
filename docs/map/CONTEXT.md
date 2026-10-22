# How to walk this map

One job: answer "what is X" and "what else moves if I change X" without reading the whole repo.

## Walk
1. `CLAUDE.md` (catalog + name collisions).
2. `objects/_index.md`: one line per noun with status `stub | verified | stale`.
3. One card. Cite source before trusting a card; `verified` requires a date, a commit and citations.

## Rules
- The repo is authoritative. If a card and the repo disagree, the repo wins and the card is marked `stale`.
- Twenty is canonical for facts the repo mirrors (docs/, KYNETIC_CONTEXT.md). Flag mismatches with both values.
- Hits / Does not hit is first-order only. "Does not hit" names the obvious next noun that is the wrong one.
- Things outside the repo that point in (n8n instances, Retell, Twenty, the VPS, the deploy trigger) are recorded on the card they land on.
- Slice order: catalog, nouns, verbs, change-impact index, re-verify. A person reads each slice before the next starts.

## No-touch (nothing in this map may suggest editing these)
Nora (agent, LLM, workflow), Emily, Retell agent tools, Kynetic Restoration (Demo) records and build files, the AM-1 Roofing number, `.env` files and every secret, template workflow `KYQIVtxwDcXVKmk3`. IDs: `../../KYNETIC_CONTEXT.md`.

## Status
Slice 1 done (this folder). Slice 2 (object cards) not started: `processes/` and `effects/` are intentionally absent until nouns exist.
