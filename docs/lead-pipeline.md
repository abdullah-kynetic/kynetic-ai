# Lead pipeline runbook (Plan 1 tasks 2.1-2.5)

Goal: a repeatable loop that keeps a stock of audited, owner-named, FL/OK-free home-service leads in Twenty for the human dialers (75 a day). No Google Sheets (2.5's wording is superseded: the loop writes to `leads.db`, then Twenty).

```
census (lead_engine.py, Treg)  ->  enrich (lead_engine.py + lead_enrich.py, Firecrawl)
   ->  audit (lead_pipeline.py audit)  ->  import (lead_pipeline.py import --apply)  ->  humans dial in Twenty
   ->  sync (lead_pipeline.py sync --apply) marks called  ->  refill (lead_pipeline.py refill) when stock < 3 days
```

## Commands (all dry runs unless `--apply`)
| Step | Command | Spends / writes |
|---|---|---|
| Census + enrich | `lead_engine.py run --niche roofing --state TX --metro DFW --enricher firecrawl` | Treg dollars (~$0.0011 a page), Firecrawl credits (~5 a business) |
| Audit | `lead_pipeline.py audit [--dnc-file numbers.txt]` | local only |
| Stock | `lead_pipeline.py report` | local only |
| Load | `lead_pipeline.py import` then `--apply` | Twenty: Company + owner Person per lead, deduped on Meta Page ID |
| Outcomes | `lead_pipeline.py sync` then `--apply` | local `called` flag from Twenty leadStatus |
| Top up | `lead_pipeline.py refill` then `--apply` | next niche/state batch, Treg cap $1 and Firecrawl cap 400 by default |

## The audit gate (code, not judgment)
A `DIAL_READY` row passes only if: state is set and not FL/OK; best phone is 10 digits, has a source URL, is not an FL/OK area code and is not in the do-not-call file; there is an owner who is a named person (not an LLC/management entity) with a source URL; no AI call answering or franchise wording; not already called. Failures drop to `HOLD` with the reason. Import only loads `audit=PASS` rows, skips Meta Page IDs already in Twenty, and skips any phone that belongs to a Twenty company marked `DO_NOT_CALL` (this is what keeps AM-1 Roofing, 541-388-3621, from ever being loaded).

## What the gate does not prove
It does not prove the owner or phone belongs to the right business (KI-012: BBB/registry name matches can attach another business) or that the phone reaches the owner. Spot-check each batch against the Facebook page before dialing, and hand-dial a sample to measure reach. Federal/state DNC scrubbing is not automated: pass `--dnc-file` once counsel (task 1.4) names the source.

## Live steps that need Abdullah's yes (none done)
1. Treg top-up (balance is spent) for any new census.
2. `TWENTY_API_KEY` in the cloud environment, then `import --apply` on the dry-run list he has read.
3. Scheduling `refill --apply` (cron, Modal, or an n8n workflow built inactive).
4. Treg phone finder stays off until counsel clears it.
