# Repo audit (2026-10-22)

Read from source at `cbb5046`; nothing run against a live system, `tools/*.py` not executed. Ordered by consequence. "Verified" = I read the cited lines.

## Fix first
1. **`tools/retell.py` has no guard on which agent it writes to.** `rename-agent`, `set-begin-message`, `set-agent-webhook` PATCH whatever id is passed (`tools/retell.py:206-211`); `repoint-tools` swaps tool URLs on any LLM. Only the instructions stop a write against Nora/Emily. `.claude/settings.json` also pre-approves `python tools/retell.py *`, so `--apply` needs no prompt. Fix: hard-code a deny list of the Nora/Emily/Restoration ids in the script, and narrow the allowlist to read subcommands. (Needs your yes: it edits a tool and a settings file.)
2. **The post-call webhook secret is committed.** The webhook path in `n8n/workflows/active/outbound-speed-to-lead__m2YJwZ1l8DTzyEkw.json:743` is the only protection (`authentication: none`, `:740`; KI-005). Anyone with repo access can POST fake call results into Twenty. The note in KI-005 says keep the repo private until fixed. Fix: header auth or signature check on the webhook, then rotate the path.
3. **`tools/n8n_backup.py` deletes repo files** that are not in the n8n it queried (`:83-84`, `:92-93`). Pointed at the VPS it removes the 52 cloud copies. Fix: add `--keep-missing` default or move missing files to `archive/` instead of unlinking.

## Stale or wrong
4. `retell/builds/outbound-speed-to-lead/N8N_MAPPING.md:3` says the workflow has 27 nodes, is inactive and never run. The backed-up workflow has 38 nodes and is active; KI-009 is resolved.
5. Nothing saved in the repo or the n8n backup posts to the portal ingest API (`grep api/ingest n8n/` is empty), so the portal Results page has no feeder here (`portal/N8N.md` describes one).
6. Agent id and from-number `+16692660586` are literals in two Set nodes (Call Settings, Retell Call Settings), so they can drift apart. Whether that number is Nora's line is still unchecked (progress Blockers 3).
7. `docs/decisions.md` heading order is D-013, D-016, D-015, D-014, D-011, D-012, D-017 (lines 60-100). Cosmetic but agents grep by number.
8. `CAL_API_KEY` is read from the environment only (`tools/retell.py:125`) while the docs say env or `.env`; `.env.example` lists it.
9. `retell/builds/_inflate-original/agent.json` contains Nora's id; the script has no knowledge of it.

## Structural
10. `portal-deploy.sh` rsyncs all of `portal/` with `--delete` (`:74`) and copies only `docker-compose.yml` (`:75`). The deploy scripts on the VPS are separate copies that no deploy updates. The deploy trigger is not in the repo.
11. `docs/progress.md` is 23 KB and is read first in every session; most of it is the dated log.
12. 49 remote branches; some state (Alex prompt v1.2.3, the bake-off `providers/`) lives only there.

## Checked and fine
- Portal ingest: key-hash compare, rate limits, strict body, scoped insert (`route.ts:21-70`). Tenancy scopes set per transaction (`scoped.ts:21-32`) and static tests enforce `requireAdmin()`/`requireClient()` patterns.
- `create-outbound` cannot edit an existing agent (`retell.py:178-179`); `repoint-tools` refuses non-URL changes (`:92-97`).
- Nothing in `portal/src` calls Twenty or Retell.
