# Free AI Audit: build blueprint

Written 2026-11-20 for the executor that finishes the build. Branch `claude/project-thread-wuzri7`, WIP commit `6e4475a`.
This file is the spec. If code and this file disagree, this file wins. If this file is unclear or wrong, stop and ask Abdullah. Don't guess.

---

## 0. Rules for the executor (read first)

1. Work only on branch `claude/project-thread-wuzri7`, in the `audit/` folder. Exceptions: this doc, `docs/coordinator/free-audit.md`, and the new `docs/audit/` docs listed in section 13.
2. Commit identity: run every commit with
   `GIT_AUTHOR_NAME=abdullah-kynetic GIT_AUTHOR_EMAIL=abdullah@kyneticai.com GIT_COMMITTER_NAME=abdullah-kynetic GIT_COMMITTER_EMAIL=abdullah@kyneticai.com`.
   No AI trailer, no `Co-authored-by`, no "Generated with" footer. Never force-push. Check with `git log -1 --format='%an <%ae> / %cn <%ce>'` before pushing.
3. Make one commit per task in section 15, with the task ID in the message (for example `T3: async webhook and callback`). Push after each task.
4. Don't deploy to Modal, create Modal secrets, touch n8n, send email, open a PR or merge anything. All of that needs Abdullah's yes on the exact step.
5. Never print or commit a key. Keys come from environment variables only.
6. Free tier only:
   - No paid API.
   - OpenRouter models must end in `:free`. `config.require_free_model` enforces this; keep it.
   - Google PageSpeed is free with a key.
   - Lighthouse CLI, Playwright and public Google Maps cost nothing.
7. Never invent evidence. If a tool fails, its section says "We couldn't check this" plus the reason. Never fill a gap with a guess, a default number or model text.
8. Hard business rules:
   - Reject Florida (`FL`) and Oklahoma (`OK`) businesses.
   - Reject anything HIPAA, healthcare or medical (`parse_request` already does this; keep it).
   - No outreach of any kind.
9. Tests run with no network and no keys: `python3 -m pytest -q audit/tests`. Every task ends with tests green.
10. When stuck after two attempts on the same failure, stop and report the exact error. Don't rewrite unrelated parts.

---

## 1. Goal

A prospect (or Kynetic, for a lead) asks for an audit. n8n sends the request to one secured Modal webhook. Modal runs every check, scores the business, writes evidence-backed findings, and renders a branded visual report (HTML and PDF). Then it posts the results and signed report links back to n8n. n8n handles everything before (form, lead save) and after (email, portal). Modal never talks to the portal, the website or email.

The report is the entry offer. It must read like a paid consultant's report:
- a clear score
- a section for every tool used: what it checked, what it found, what it means and the fix
- a "what this is costing you" scenario, built only from the prospect's own numbers
- the Kynetic services that fit, then a booking button

Two editions:
- **free:** the instant audit sent to a prospect.
- **full:** the deeper version Kynetic sends after or before a call.

`operator` mode stays as it is today (Kynetic-internal, no answers allowed).

Out of scope: paid providers (section 17), portal integration, site form changes, n8n workflow building.

---

## 2. Current state of the code (commit 6e4475a)

| File | State | Action |
|---|---|---|
| `audit/models.py` | New: `Business` (+phone, address), `AuditRequest` (+callback_url, lead), `CheckResult` (+tool, sources, observed_at), `Item`, `Finding` | Keep |
| `audit/net.py` | New: `fetch()` with SSRF guard (`assert_public`), redirect guard, `now_iso`, `normalize_url` | Keep |
| `audit/checks/crawl.py` | New: `crawl_site()` reads the home page, up to N priority internal pages, robots.txt and the sitemap. `crawl_check()` | Keep |
| `audit/checks/page.py` | New: `parse_page()` → `PageFacts`, `phones_in`, `digits_only` | Keep |
| `audit/checks/util.py` | New: `score_items`, `items_data`, `yes` | Keep |
| `audit/checks/seo.py` | Rewritten: `analyze_seo(crawl, business)` with 18 lines; `inspect_html` kept | Keep, fix per 6.2 |
| `audit/checks/signals.py` | Rewritten: `analyze_conversion(crawl)`, `analyze_trust(crawl)`; `inspect_signals` kept | Keep |
| `audit/checks/pagespeed.py` | Extended: per-strategy URL, metrics, opportunities, `run_local_lighthouse`, `parse_lighthouse_report`, `speed_check` | Keep, fix per 6.4 |
| `audit/checks/maps.py` | Extended: `listing_check()` reads the public Maps listing, local results and the full-edition 9-point grid. Old `parse_maps_page` kept | Keep, fix per 6.5 |
| `audit/checks/ai_mentions.py` | Extended: new prompts, competitors parsed, `mentioned_in` / `others_named` | Keep |
| `audit/checks/unlighthouse.py` | Unchanged (full edition, site-wide) | Keep |
| `audit/checks/geocode.py`, `audit/geogrid.py` | Old Nominatim grid. Nominatim blocks cloud IPs; Maps now gives coordinates | Delete both and their tests in T2 |
| `audit/checks/full.py` | `run_full_only`, `run_operator_only` | Keep |
| `audit/scoring.py` | Rewritten: 7 categories, weights, `grade()` | Keep |
| `audit/answers.py` | New: answer keys, aliases, `operations_items`, `number`, `percent`, `told_us` | Keep |
| `audit/findings.py` | New: `RULES`, `build_findings`, `revenue_scenario`, `services_for`, `SERVICES` | Keep |
| `audit/service.py` | OLD orchestration. Calls removed functions and is broken | Rewrite in T2 |
| `audit/app.py` | OLD synchronous Modal app | Rewrite in T3 |
| `audit/pdf/teaser.py`, `audit/pdf/render.py` | OLD 12-line template | Replace with `audit/report/` in T5 and T6 |
| `audit/local_server.py` | Old sync harness | Update in T3 |
| `audit/acceptance.py` | Synthetic run that made the useless samples | Replace in T8 |
| `audit/scripts/live_probe.py` | Imports old names | Update in T8 |
| `audit/web/*` | Fake 3-line demo form, unused | Delete in T2 |
| `audit/tests/*` | Old tests. Some now fail | Rewrite per task |
| `audit/examples/sources.json` | Dated public evidence for 3 East Bay roofers (from t3/free-audit) | Keep. Use as the cross-check in T8 |
| `audit/vendor/` | License notices only | Keep |
| `audit/DEPLOY.md` | Old | Rewrite in T9 |

What was verified live from the cloud container on 2026-11-20:
- **Lighthouse CLI 13.5.0** with Playwright's Chromium: Moran Roofing scored mobile perf 48, SEO 92, accessibility 88, best practices 73, LCP 5.2 s. The run takes about 17 s.
- **Public Google Maps** via Playwright, Moran Roofing:
  - listing: 4.4 stars, 19 reviews, category, address, phone, hours, "Book online", 12 photos, 3 review snippets and coordinates
  - local search "roofing contractor Livermore CA": rank 3, with competitors' ratings and review counts
  - 9-point grid: top 3 at 8 of 9 points
  - Free run about 9 s; full run about 36 s.
- **PageSpeed API without a key:** HTTP 429. A key is required, and the Lighthouse fallback covers the gap.
- **Nominatim:** 403 from cloud IPs, so don't use it.
- **macielroofing.com:** timed out from the cloud. The crawler must handle this (couldn't check).

---

## 3. Architecture

```
n8n (form / lead)                Modal app "kynetic-audit"                          n8n (email / portal)
POST /audit  ───────────────▶  web(): validate, auth, idempotency, caps
  X-Audit-Key                   store run {status: queued} in Dict
◀── 202 {run_id, status_url}    worker.spawn(run_id)
                                worker(): pipeline.execute()
                                  crawl ─┬─ seo, capture, trust (from crawl)
                                         ├─ speed (PageSpeed → Lighthouse fallback)   (parallel)
                                         ├─ listing (Google Maps, Playwright)          (parallel)
                                         ├─ ai_mentions (OpenRouter :free)             (parallel)
                                         └─ sitewide (Unlighthouse, full only)         (parallel)
                                  score → findings → scenario → services → summary
                                  report: HTML + PDF → Volume
                                  store run {status: done, result}
                                  POST callback ─────────────────────────────────▶  callback_url
                                     X-Audit-Signature: sha256=<hmac>                (n8n verifies, emails link)
GET /audit/{run_id}  (polling fallback)
GET /report/{run_id}.pdf|.html?exp=&sig=   (signed, 30-day links)
```

Module layout after the build:

```
audit/
  app.py            Modal image, functions, FastAPI routes (thin)
  api.py            framework-free handlers: submit(), status(), report_file(); used by app.py and local_server.py
  pipeline.py       execute(request, deps) → result dict (the old service.py, rewritten)
  service.py        tiny shim: parse_request() + REJECTED_STATES (kept so imports don't break)
  store.py          RunStore protocol, MemoryStore (tests/local), ModalStore (modal.Dict + Volume)
  callback.py       sign(), verify(), deliver(url, payload, secret) with retries; host allowlist
  summary.py        executive summary: free-model write-up with a fact guard, deterministic fallback
  answers.py  findings.py  scoring.py  models.py  net.py  config.py
  checks/           crawl, page, seo, signals, pagespeed, maps, ai_mentions, unlighthouse, full, util
  report/
    __init__.py     build_view(result) → dict ready for the template
    render.py       render_html(view) → str ; render_pdf(html, path) → Path
    charts.py       SVG builders (score ring, bars, meters, grid, comparison)
    template.html   the report (string.Template, $-placeholders) — see section 10
    styles.css      inlined into the HTML at render time
    assets/         inter-var.woff2, cormorant-garamond-var.woff2, logo-light.svg, mark.svg
  tests/
  examples/sources.json
  samples/          generated sample reports (T8), committed
```

---

## 4. API contract (Modal webhook)

Base URL: whatever `modal deploy` prints for function `web`. Every route except `/health` needs header `X-Audit-Key: <AUDIT_SERVICE_API_KEY>`. Compare it with `hmac.compare_digest`.

### 4.1 `POST /audit`, request

```json
{
  "mode": "free",                        // "free" | "full" | "operator"   (required)
  "business": {                          // required
    "name": "Moran Roofing & Inspection",// required
    "website": "https://moranroofing.com",// required
    "city": "Livermore",                 // required
    "state": "CA",                       // required, 2 letters; FL and OK rejected
    "industry": "roofing contractor",    // required; used in Maps and AI searches
    "phone": "925-454-9200",             // optional; enables the phone-match check
    "address": "543 Leisure St"          // optional
  },
  "answers": { "monthly_leads": "20-50", "avg_job_value": "$12,000", "after_hours": "voicemail" },  // optional; keys in section 7.3
  "lead": { "id": "portal-or-n8n-id", "email": "owner@example.com", "contact_name": "Pat" },        // optional, echoed back untouched
  "idempotency_key": "n8n-execution-123",// optional but n8n should always send one
  "callback_url": "https://n8n.kyneticai.com/webhook/audit-complete"  // optional; else AUDIT_CALLBACK_URL env
}
```

Validation (return 422 `{"error": "<reason>"}`):
- `mode` not in the set.
- A required business field is missing or blank.
- `state` is FL or OK, or the industry or name contains hipaa / medical / clinic / dental / health (`unsupported business`).
- `website` is not http(s).
- `callback_url` host is not in `AUDIT_CALLBACK_HOSTS` (comma list, default `n8n.kyneticai.com`).
- `operator` mode with answers.
- Strings longer than 300 characters.
- Payload over 64 KB (413).

Cap reached: 429 `{"error": "audit capacity cap reached"}`. Checked before queueing:
- daily count ≥ `AUDIT_DAILY_CAP` (default 50, UTC day)
- concurrent queued or running runs ≥ `AUDIT_MAX_RUNNING` (default 4)

### 4.2 `POST /audit`, responses
- New run: **202** `{"run_id": "<uuid4>", "status": "queued", "status_url": "/audit/<run_id>"}`
- Same `idempotency_key` seen in the last 7 days: **200** with the current run record (section 4.3). No new run, and it doesn't count toward the cap.

### 4.3 `GET /audit/{run_id}`
200 `{"run_id", "status": "queued|running|done|failed", "mode", "business": {...}, "lead": {...}, "created_at", "finished_at", "error", "result": <result or null>, "report": {"pdf_url", "html_url", "expires_at"} | null}`. Unknown run: 404.

### 4.4 Callback (Modal → n8n)
POST `callback_url` with `Content-Type: application/json`. Headers:
- `X-Audit-Signature: sha256=<hex hmac of raw body with AUDIT_CALLBACK_SECRET>`
- `X-Audit-Event: audit.completed|audit.failed`
- `X-Audit-Run: <run_id>`

Body:
```json
{
  "event": "audit.completed",
  "run_id": "…", "mode": "free", "idempotency_key": "…",
  "business": {...}, "lead": {...},
  "overall_score": 63, "grade": "C",
  "sections": [{"key": "seo", "label": "Website & search", "score": 71, "grade": "B", "checked": true}, …],
  "top_findings": [{"title", "severity", "observed", "fix", "service"} ×3],
  "services": [{"key", "name"} …],
  "summary": "2-3 sentence plain-English summary",
  "report": {"pdf_url": "https://…/report/<id>.pdf?exp=…&sig=…", "html_url": "…", "expires_at": "2026-12-20T…Z"},
  "checks_status": {"crawl": "ok", "seo": "ok", "capture": "ok", "trust": "ok", "speed": "ok", "listing": "ok", "ai_mentions": "couldnt_check", "sitewide": "skipped"},
  "cost_cents": 0, "duration_ms": 41230, "finished_at": "…Z"
}
```

Failure body: `{"event": "audit.failed", "run_id", "idempotency_key", "business", "lead", "error": "<short reason>"}`.

Delivery:
- Up to 4 attempts, 2 s, 10 s, 30 s apart, 10 s timeout each.
- A non-2xx response counts as a failure.
- Record `callback: {"delivered": bool, "attempts": n, "last_status": int}` on the run.
- Never retry forever. n8n can poll `GET /audit/{id}` as the fallback.

### 4.5 Report links
`GET /report/{run_id}.pdf?exp=<unix>&sig=<hex>` and `.html`.
- `sig = hmac_sha256(AUDIT_SERVICE_API_KEY, f"{run_id}.{ext}:{exp}")`.
- TTL is `AUDIT_REPORT_TTL_DAYS` (default 30).
- Expired or bad signature: 401. Missing file: 404.
- These links need no `X-Audit-Key`, so they can go straight into an email.

### 4.6 `GET /health`
200 `{"status": "ok", "service": "kynetic-audit", "version": "<git sha or 'dev'>"}`. No auth.

---

## 5. Pipeline (`pipeline.execute`)

Signature:

```python
def execute(request: AuditRequest, deps: Deps, operator_authorized: bool = False) -> dict
```

`Deps` is a dataclass of injectable callables (tests pass fakes). Each defaults to the live implementation:

- `fetch: Callable[[str], net.Response]`: `net.fetch`
- `pagespeed_transport`: from `service._pagespeed_transport` logic (moves here); None when no `GOOGLE_PAGESPEED_API_KEY`
- `local_lighthouse: Callable[[str, str], CheckResult]`: `checks.pagespeed.run_local_lighthouse`
- `maps_session`: None → the live Playwright session inside `listing_check`
- `openrouter_ask`, `openrouter_models`: from old `service.py` (move here unchanged)
- `unlighthouse: Callable[[str, str], CheckResult]`: `checks.unlighthouse.run_unlighthouse`
- `clock: Callable[[], float]`: `time.monotonic`

Order and budget (the total must finish inside the 600 s function timeout; target under 120 s for free):

1. `crawl = crawl_site(website, deps.fetch, max_pages=6 if free else 15)`. Then `checks["crawl"] = crawl_check(crawl)`.
2. From the crawl, with no network: `seo = analyze_seo(crawl, business)`, `capture = analyze_conversion(crawl)`, `trust = analyze_trust(crawl)`.
3. In a `ThreadPoolExecutor(max_workers=4)`, each wrapped in `_safe(fn)`. `_safe` turns any exception into `couldnt_check` with `f"{type}: {msg}"`, and records `ms`, `tool` and `observed_at`:
   - `speed = speed_check(website, key, transport, deps.local_lighthouse)`. Free: mobile and desktop. Budget 150 s.
   - `listing = listing_check(business_dict, mode, deps.maps_session, deadline_s=100)`.
   - `ai_mentions = check_mentions_with_fallback(business_dict, models, ask)`. Budget 30 s. Skip with `skipped` / "OpenRouter key not configured" when there's no key.
   - `sitewide = run_full_only(mode, "sitewide", lambda: deps.unlighthouse(mode, website))`. Full only.
4. `answers = answers.normalize(request.answers)` (operator: always `{}`).
5. `scored = scoring.score(answers, checks)`.
6. `ops = answers.operations_items(answers)`. Then `findings = findings.build_findings(checks, answers, ops)`.
7. `scenario = findings.revenue_scenario(answers)`. Then `services = findings.services_for(findings)`.
8. `summary = summary.write(business, scored, findings, deps)` (section 9).
9. Return the result dict (section 5.1).

`checks` keys are fixed: `crawl, seo, capture, trust, speed, listing, ai_mentions, sitewide, phantomreach`. Every value is `asdict(CheckResult)`. `phantomreach` is always `skipped` unless operator mode, operator-authorized and `operator_phantomreach` (keep the old rule).

### 5.1 Result dict
```python
{
  "run_id": str, "mode": str, "edition": "free"|"full"|"operator",
  "business": asdict(request.business), "lead": request.lead,
  "generated_at": now_iso(),
  "overall_score": int|None, "grade": str, "section_scores": {...}, "sections": [...], "checked_categories": int,
  "findings": [asdict(f) for f in findings],          # all of them; the report decides how many to show
  "top_findings": first 3 findings (title, severity, observed, fix, service),
  "scenario": scenario or None,
  "services": services,
  "told_us": answers.told_us(answers),
  "summary": str,
  "checks": checks,
  "cost_cents": sum of check cost_cents (0 on free tier),
  "duration_ms": int,
}
```
Same input plus the same fakes must give the same output except `run_id`, `generated_at`, `observed_at`, `ms` and `duration_ms`. A test checks this.

---

## 6. The checks (what each tool does, and fixes still needed)

Each check returns `CheckResult(status, data, cost_cents, ms, reason, tool, sources, observed_at)`. Checks with lines put them in `data["items"]` as `Item` dicts and the 0-100 score in `data["score"]` (`util.score_items`: pass = 1, warn = 0.5, fail = 0, weighted; info and unknown are ignored).

The report shows, for each check:
- the tool name
- "What we checked" (one sentence, from `report/copy.py`, see 10.4)
- the score
- the lines table (label · value · status chip)
- the findings for that category
- the sources it read

### 6.1 Website crawler (`checks/crawl.py`), tool "Website crawler"
- **Reads:** the home page (follows redirects with the SSRF guard), then up to 5 (free) or 14 (full) same-site links, ranked by `PRIORITY` keywords. Also `/robots.txt` and the sitemap from robots or `/sitemap.xml`.
- **Bot challenge:** if the home page has a challenge marker and is under 60 KB, the crawl is `blocked`.
- **Fix needed:**
  - `fetch` timeout is 20 s; keep it, but cap total crawl time at 45 s (stop fetching more pages after that).
  - Add `crawl.elapsed_ms`.
- **No crawl:** seo, capture and trust all return `couldnt_check` with the crawl's reason.

### 6.2 On-page SEO (`checks/seo.py`), tool "On-page SEO scan"
Lines as coded: https, title, title_city, title_service, meta_description, h1, viewport, indexable, canonical, local_schema, open_graph, alt_text, content, robots, sitemap, nap_phone, city_mention, service_pages.

Fixes:
- (a) `title_service`: replace `w[:5] in title` with a check that any industry word of 4+ letters appears in the title or H1, case-insensitive, also trying singular and plural.
- (b) `service_pages`: the regex hardcodes roofing words. Build it from the industry words plus `service|services|area|areas|repair|install|installation|replacement` plus the city slug.
- (c) Add the line `gbp_link` "Links to your Google listing" (warn if missing). It's true when any link host is `g.page`, `maps.app.goo.gl`, `goo.gl/maps`, or `google.com/maps`, or the URL contains `cid=`.
- (d) Never put raw HTML in values. Values are short strings under 100 characters.

### 6.3 Lead capture and trust (`checks/signals.py`)
- "Lead capture scan" lines: click_to_call, lead_form, online_booking, chat, text_us, after_hours, offer, financing, cta_count.
- "Trust signals scan" lines: reviews_on_site, license, insured, experience, guarantee, badges, portfolio, about, privacy, social.
- Fixes:
  - (a) `BADGES` short words ("bbb", "gaf", "angi", "nari") need word-boundary matching. It's already done with `\b`; keep it, and drop the generic words `"award"`, `"certified"` and `"accredited"` from `BADGES` (too many false positives). Put them in a separate `info` line, `mentions_awards`.
  - (b) `chat` must not count `leadconnectorhq` as chat unless the string `chat-widget` or `LC_chat` also appears. Otherwise it's booking only.
  - (c) The `reviews_on_site` regex `reviews?\b.*\bstars?` is greedy across the whole page. Limit it to within 200 characters: `reviews?\b.{0,200}\bstars?`.

### 6.4 Site speed (`checks/pagespeed.py` → `speed_check`)
- **Tool:** "Google PageSpeed Insights (Lighthouse)" when the API key works, otherwise "Lighthouse (run by Kynetic)". Mobile and desktop.
- **Data per strategy:** `scores` {performance, seo, accessibility, best-practices}, `metrics` {fcp, lcp, tbt, cls, speed-index: label, value, score}, `opportunities` (top 6, savings_ms ≥ 150).
- Fixes:
  - (a) Replace non-breaking spaces (`\xa0`, ` `) in `displayValue` with normal spaces.
  - (b) `run_local_lighthouse` must pass `--max-wait-for-load=45000` and run with a 120 s timeout. Run mobile and desktop one after the other, not in parallel; they share one Chrome.
  - (c) The PageSpeed transport uses `net.fetch(url, timeout=90, guard=False)` and maps it to `(status, body)`.
  - (d) Keep the old `fetch_pagespeed` retry behavior and its tests.

### 6.5 Google listing and local ranking (`checks/maps.py` → `listing_check`)
- **Tool:** "Google Maps (public listing)". One headless Chromium, en-US, public pages, no sign-in.
- **Step 1:** search `"{name} {city} {state}"`. If Maps opens a place page and the H1 matches (`similar() ≥ 0.6`), parse the panel: rating, reviews, category, address, phone, hours, website, book_online, photos, review_snippets, latitude, longitude and maps_url. If Maps shows a list instead, click the best match ≥ 0.6.
- **Step 2:** search `"{industry} {city} {state}"` centered on the place coordinates when known. Read up to 20 result cards (name, rating, reviews, category, phone, hours, sponsored, has_website, book_online).
  - Our rank = the position among non-sponsored results.
  - Competitors = the first 5 non-matching results.
  - `market_avg_rating` = the mean rating of the top 10.
- **Step 3 (full only):** the same search from the place center plus 8 points on a 4 km ring at zoom 14. Record rank or None and result count. `grid_summary` {points, found, top3, avg_rank}. Stop when past the deadline.
- Fixes:
  - (a) The click-on-best-match line uses an awkward locator. Replace it with `page.locator(f'a.hfpxzc[aria-label="{css_escape(best["name"])}"]').first.click()`.
  - (b) Add `business.address` to the step-1 query when given.
  - (c) If Google shows a consent wall or `/sorry/`, return `couldnt_check` "Google blocked the automated view". Don't retry more than once.
  - (d) Collect `place["website"]` and compare its host with the business website host. Add `website_matches: bool|None` to the data (shown as a line in the report).
  - (e) Expose `session` for tests: `session(business, term) -> dict` with keys place, pack, grid, errors and urls (already supported; add a fixture).
- **Wording rule:** label the grid "Local ranking grid, checked from 9 points about 4 km apart on {date}". Never call it "your ranking everywhere".

### 6.6 AI assistant visibility (`checks/ai_mentions.py`)
- **Tool:** "AI assistant answers (OpenRouter free model)".
- **What it does:** asks 3 local-recommendation prompts and records whether the business is named, and who else is named.
- **Always label it** "Model recall, not live search: this shows what an AI model remembers about your market, not a live ChatGPT result."
- **Fix:** raise `max_tokens` in `_openrouter_ask` to 300.

### 6.7 Site-wide scan, full only (`checks/unlighthouse.py`)
- **Tool:** "Unlighthouse (site-wide Lighthouse)". It scans up to 15 pages. Keep it as is.
- **Report:** a pages-scanned count and average scores.

### 6.8 Answers (`answers.py`)
These are not a tool; the report shows them as "What you told us". The Operations score is built only from answers. With no answers, the Operations category shows "Not scored: answer 4 quick questions in the full audit."

---

## 7. Scoring (`scoring.py`)

### 7.1 Categories and weights

| Key | Label | Weight | Score source |
|---|---|---|---|
| seo | Website & search | 1.0 | `seo.data.score` |
| listing | Google listing & local ranking | 1.25 | `listing_score()` |
| speed | Site speed (phone) | 0.75 | `speed_score()`: mobile 75% + desktop 25% |
| capture | Lead capture | 1.25 | `capture.data.score` |
| trust | Trust & reputation | 1.0 | `trust.data.score` |
| ai | AI assistant visibility | 0.5 | share of prompts that named the business |
| operations | Follow-up & operations | 1.25 | `score_items(operations_items(answers))` |

Overall = the weighted mean of the categories that were checked. A category that wasn't checked is left out, never counted as 0. Grade: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, F below that.

### 7.2 `listing_score` (already coded)

| Part | Weight | Rule |
|---|---|---|
| Listing found | 25 | Found = 1, not found = 0 |
| Rating vs the market average | 15 | Gap ≤ 0.05 = 1; ≤ 0.3 = 0.6; otherwise 0.25 |
| Reviews vs competitor median (top 3) | 20 | ≥ median = 1; ≥ half the median = 0.6; otherwise 0.2 |
| Rank | 40 | Full edition: share of grid points in the top 3. Free edition: rank 1-3 = 1, 4-10 = 0.5, otherwise 0 |

Fix: when the listing isn't found and the rank is None, return 0. Today it already returns a low score; add a test.

### 7.3 Answer keys accepted (section in `answers.py`)
`lead_source, after_hours, response_time, monthly_leads, follow_up, crm, time_drain, team_size, revenue, avg_job_value, close_rate, fix_first`. Aliases from the website application: `niche, revenue, teamTime→team_time, fixFirst→fix_first, invest`. Legacy `q1`-`q6` are mapped. Unknown keys are kept and displayed.

---

## 8. Findings, scenario, services (`findings.py`)

- Rules are in `RULES` (item key → category, severity, title, why, fix, service). Plus coded rules for speed, listing (missing, rank, reviews, rating, grid), AI absence and operations answers.
- Sort: severity (high, medium, low), then category, then id.
- **Report limits:**
  - free: top 6 findings in the summary page, plus each category section shows its own findings (max 4 each)
  - full: all findings
- **Scenario:**
  - Built only when the prospect gave `monthly_leads` and `avg_job_value`.
  - Slip-rate assumption 10-20%. Close rate is the answer if given, else an assumption of 20-30%.
  - Every input is shown with "your answer" or "assumption".
  - Never show a dollar figure without its inputs table directly beside it.
- **Services:** ranked by the summed severity weight of the findings that point at them (high 3, medium 2, low 1). Add "AI Transformation" when 3 or more services are triggered.
- Fixes:
  - (a) Add `_dedupe(findings)`: drop a finding only when its title is identical to one already kept (keep the higher severity).
  - (b) Free edition: in `services_for`, skip services with weight 0 except AI Transformation.

---

## 9. Executive summary (`summary.py`)

`write(business, scored, findings, deps) -> str`, 2-3 sentences, plain English, no hype.

1. Build `facts`: business name, city, overall score and grade, the 3 lowest checked categories with scores, and the top 3 finding titles plus their `observed` strings.
2. If an OpenRouter key exists, ask the free model, with a 20 s budget and the model fallback list. The prompt is "Write 2-3 short sentences for a business owner summarizing these audit facts. Use only these facts. No numbers that are not in the facts. No promises." plus a JSON dump of the facts.
3. **Guard:** reject the model text if it contains any number not present in the facts JSON, is over 450 characters, contains a URL, or contains "guarantee".
4. Fallback (always used in tests): `f"{name} scored {score}/100 ({grade}). The biggest gaps are {cat1} ({s1}) and {cat2} ({s2}). Start with: {top finding title lowercased}."`. Handle missing pieces gracefully.
5. Return the text. Record which path was used in `result["summary_source"] = "model:<id>" | "template"`.

---

## 10. The report (`audit/report/`)

A single self-contained HTML file: fonts as base64 data URIs, CSS inlined, SVG inline, no external requests. The PDF is rendered from the same HTML with Playwright Chromium: `page.pdf(format="Letter", print_background=True, margin=0, prefer_css_page_size=True)`. Both are saved as `/<volume>/<run_id>.html` and `.pdf`.

### 10.1 Visual system (brand, from `brand/README.md`)
- **Colors:**
  - page `#faf8f5`
  - ink `#14100c`
  - espresso `#281F1C`
  - orange `#D9662A` (accent and primary buttons)
  - champagne `#C9A96E` (only on espresso backgrounds)
  - muted text `#6b625c`
  - rule lines `#e6e0d8`
- **Status colors** (flat, no gradients, glows or shadows):
  - pass `#2f7d4f`
  - warn `#b7791f`
  - fail `#b23b2a`
  - couldn't check `#8a817a`
- **Fonts:** headings in Cormorant Garamond (`site/public/fonts/cormorant-garamond-var.woff2`), body in Inter (`inter-var.woff2`). Copy both into `audit/report/assets/`.
- **Logo:** `brand/logo/lockups/lockup-b-horizontal-light.svg` on light pages, and `lockup-b-horizontal-dark.svg` on the espresso cover. Copy both into `assets/`.
- **Page:** US Letter, 0.6 in margins via `@page { size: Letter; margin: 0.6in }`. Every page has a footer: "Kynetic AI · Free AI Audit · {business} · page N". Use `@page` counters, or a fixed footer with the page number filled by Playwright's footerTemplate. Pick the footerTemplate (simpler).
- **Body** 10.5 pt, line height 1.45. H1 32 pt, H2 20 pt, H3 13 pt.
- **Accessibility:** text contrast ≥ 4.5:1 (all the colors above pass on `#faf8f5`; check warn `#b7791f` text and use it only for chips with dark text if it fails). Use real headings in order, alt text on the logo, and `lang="en"`.

### 10.2 Charts (`report/charts.py`, pure SVG strings, deterministic)
- `score_ring(score, grade, size=160)`: a circle track in `#e6e0d8` and an arc in orange proportional to the score, with the number in Cormorant 44 pt and the grade below. None → a grey ring with "—".
- `category_bars(sections)`: one row per category: label, a bar 0-100 (orange fill), and the score. A category that wasn't checked shows a hatched grey bar and the text "Couldn't check".
- `metric_meter(label, value, score)`: a small 3-zone bar (fail, warn, pass) with a marker. Used for LCP, CLS and TBT.
- `compare_bars(rows, field)`: you vs the top 3 competitors for `reviews` and for `rating`. Your row is in orange, others in espresso at 40% opacity.
- `rank_grid(grid)`: 9 circles laid out in their relative positions (center plus ring). Each shows its rank number. Fill: 1-3 pass, 4-10 warn, None fail with "10+". No map tiles.
- `mention_dots(answers)`: 3 dots, filled when named.

### 10.3 Page plan

**Free edition (target 6-8 pages):**
1. **Cover** (espresso background):
   - the logo
   - "Free AI Audit"
   - the business name (Cormorant 36 pt), city and state, and the date
   - the score ring with grade (champagne track)
   - the one-line summary
   - "Prepared for {lead.contact_name}" when known
2. **At a glance:**
   - `category_bars`
   - "Top priorities": the first 3 findings as cards (title, what we saw, fix, severity chip)
   - "What we checked" strip: the tool names with a status icon each (ok, couldn't check, skipped)
3. **Google listing & local ranking:**
   - listing facts table (name, rating, reviews, category, phone, website match, hours, Book online)
   - local rank sentence: "Searching '{term}' on Google Maps, you appear at position {rank}."
   - `compare_bars` for reviews and rating vs the top 3
   - review snippets as quotes (max 3, shown as published)
   - this category's findings
4. **Website & search:** the SEO lines table (pass, warn and fail chips), its findings, and the pages read (list of URLs).
5. **Lead capture and Trust:** two half-page tables with their findings.
6. **Site speed:**
   - mobile and desktop score tiles (performance, SEO, accessibility, best practices)
   - meters for LCP, TBT and CLS
   - top 3 opportunities in plain words
   - findings
7. **AI assistant visibility:** `mention_dots`, the names the assistant gave, and the "model recall" label. If it couldn't check, a short box with the reason.
8. **What this could be costing you:**
   - the scenario range in large type, with the inputs table beside it
   - when no scenario, a box: "Tell us your monthly leads and average job value and we'll show the cost of missed leads."
   - "What you told us": the answers table
9. **How Kynetic would fix this:**
   - the services list in rank order: name, pitch, and "because we found: {top 3 finding titles}"
   - a locked preview box listing what the full audit adds: local ranking grid, site-wide scan of up to 15 pages, every finding, a 90-day plan and a call with Abdullah
   - CTA button "Book your Full Business Audit (free, 30 min)" linking to `https://cal.com/abdullah-kyneticai/kynetic-ai-audit-call`
10. **Sources and method (appendix):**
    - every check: tool, status, observed_at in UTC, duration, sources (URLs) and the reason when it couldn't check
    - the line "Instant snapshot from public data on {date}. The Full Business Audit goes deeper into your operations, team time, lead handling and systems."

Pages 3-7 may merge onto fewer physical pages; use CSS `break-inside: avoid` on cards and tables, and `break-before: page` only on sections 1, 2, 8 and 10.

**Full edition** is the same structure with these differences:
- the cover says "Full AI Audit"
- page 3 adds `rank_grid` and the grid summary
- an extra "Site-wide scan" section (Unlighthouse)
- all findings are shown (no per-section cap)
- page 9 drops the locked box and adds "Your 90-day plan": findings grouped by service into Month 1 (high), Month 2 (medium) and Month 3 (low), max 5 lines per month

**Operator edition:** the full layout, no answers section, and the cover says "Internal audit, not for sending".

### 10.4 Copy (`report/copy.py`)
One dict, `TOOL_COPY`, keyed by check name, each with `title`, `tool_line` and `what_we_checked`. Write them in plain English, under 30 words each, no jargon. Example: `speed`: "We loaded your home page the way a phone on a mobile network would, using Google's Lighthouse, and timed how long it takes before a visitor can see and use it." Also `COULDNT_CHECK = "We couldn't check this automatically ({reason}). We'll cover it on the call."`

### 10.5 Render API
- `report.build_view(result) -> dict`: every string HTML-escaped here, numbers formatted (`$12,400`, `4.4 ★`, `5.2 s`), and edition switches.
- `report.render.render_html(view) -> str`: `string.Template(template.html).substitute(...)` plus small Python loops for repeated blocks (no Jinja dependency).
- `report.render.render_pdf(html, out_path, footer_text) -> Path`: Playwright. `executable_path` comes from `checks.unlighthouse.discover_chrome()`.
- If PDF rendering fails, the run still completes with `report.pdf_url = None`, `report.pdf_error = "<reason>"`, and the HTML link still works. Never fail silently: the callback includes `pdf_error`.

---

## 11. State and storage (`store.py`)

`RunStore` protocol: `get(run_id)`, `put(run_id, record)`, `find_idem(key) -> run_id|None`, `remember_idem(key, run_id)`, `incr_daily() -> int`, `daily_count() -> int`, `running_count() -> int`.

- `MemoryStore`: dict-backed, for tests and `local_server.py`.
- `ModalStore`: `modal.Dict.from_name("kynetic-audit-state", create_if_missing=True)`, keys:
  - `run:<id>`
  - `idem:<key>`, storing `{run_id, at}` and expiring after 7 days by checking `at`
  - `day:<YYYY-MM-DD>`, an int
  - `running` (a set as a list of ids; prune ids whose record is done, failed, or older than 15 min)
- `incr_daily` is not atomic across containers. That's acceptable with `max_containers=2` for `web`. Document it.
- Report files: `modal.Volume.from_name("kynetic-audit-reports", create_if_missing=True)` mounted at `/reports`. `volume.commit()` after writing, and `volume.reload()` before serving.
- Never store raw HTML of crawled pages in the run record. `checks` holds only the parsed data.

---

## 12. Modal app (`app.py`)

- **Image:** `debian_slim(python_version="3.11")`, then:
  - apt: `ca-certificates curl fonts-liberation fonts-dejavu-core fonts-noto-color-emoji`
  - pip: `playwright==1.49.1 fastapi==0.115.6`. Check that these exact versions exist on PyPI and are at least 2 weeks old. If not, pick the newest that is, and write down the choice.
  - Node 22 from nodesource, then `npm install -g unlighthouse@0.19.1 lighthouse@13.5.0`
  - `python -m playwright install --with-deps chromium`
  - `.add_local_python_source("audit")`
  - Report assets live inside the `audit` package, so they ship with it. Verify `report/assets/*.woff2` and `*.svg` are included; if `add_local_python_source` skips non-.py files, add `.add_local_dir("audit/report/assets", "/root/audit/report/assets")`.
- **Functions:**
  - `web` (asgi): `max_containers=2`, `timeout=60`, `memory=512`. It never runs checks.
  - `worker(run_id)`: `timeout=600`, `memory=4096`, `cpu=2`, `max_containers=4`, `retries=0`. Volume and Dict access, secrets `kynetic-audit-secrets`.
- **Env vars and secrets:**

| Name | Where | Default | Purpose |
|---|---|---|---|
| AUDIT_SERVICE_API_KEY | secret | none (required) | `X-Audit-Key` and report link signing |
| AUDIT_CALLBACK_SECRET | secret | falls back to AUDIT_SERVICE_API_KEY | Callback HMAC |
| GOOGLE_PAGESPEED_API_KEY | secret | empty → Lighthouse fallback | PageSpeed API |
| OPENROUTER_API_KEY | secret | empty → AI check skipped, template summary | Free models |
| AUDIT_OPERATOR_KEY | secret | empty | `X-Operator-Key` for operator mode |
| AUDIT_CALLBACK_URL | env | empty | Default callback |
| AUDIT_CALLBACK_HOSTS | env | n8n.kyneticai.com | Allowlist |
| AUDIT_DAILY_CAP | env | 50 | Runs per UTC day |
| AUDIT_MAX_RUNNING | env | 4 | Concurrent runs |
| AUDIT_REPORT_TTL_DAYS | env | 30 | Link lifetime |
| AUDIT_OPENROUTER_MODEL | env | none | Preferred `:free` model |
| AUDIT_PUBLIC_BASE_URL | env | the request base URL | Absolute report links in the callback |

Remove `AUDIT_DAILY_CAP_OVERRIDE` and `AUDIT_MONTHLY_CAP_CENTS` (there's no spend on the free tier). Update the test that used them.

---

## 13. Docs to write

1. `docs/audit/n8n-contract.md`: for whoever builds the n8n side:
   - (a) The intake workflow: form or website fields → the section 4.1 payload. Field mapping table from the site application (`name, email, phone, company, website, answers{niche, revenue, teamTime, fixFirst, invest}`) to `business` and `answers`, noting that `city`, `state` and `industry` must be asked or looked up because the current application doesn't collect city or state.
   - (b) Sending with an HTTP Request node and header auth.
   - (c) The callback workflow: a webhook node, an HMAC check with a Code node example in plain JavaScript (`crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`), then the email step and an optional portal save.
   - (d) Failure handling and polling.
   - (e) All workflows are built inactive; activation needs Abdullah's yes.
2. `audit/DEPLOY.md`: rewritten. Prerequisites, secrets (names only), `modal deploy audit/app.py`, smoke tests (health, 401, 422 for FL, a real run against `https://www.kyneticai.com` with no callback, then polling until done, then opening the report link, and an idempotency repeat). Also rollback (`modal app stop kynetic-audit` or redeploy the previous commit) and costs (free tier, Modal credits only).
3. Update `docs/coordinator/free-audit.md` status lines at the end (what's built, what's pending).

---

## 14. Tests (no network, no keys)

Use `unittest` style in pytest. Put fixtures in `audit/tests/fixtures/`.

| File | Covers |
|---|---|
| `test_net.py` | `assert_public` blocks 127.0.0.1, 10.x, 169.254.x, localhost and `file://`; allows a public IP (monkeypatch `socket.getaddrinfo`) |
| `test_crawl.py` | Fake transport serving a small site (home, contact, services, robots, sitemap): pages_read, priority order, max_pages respected, a challenge page marked blocked, a home 500 → couldn't check |
| `test_seo.py` | Fixture `site-good.html` scores ≥ 80; `site-bad.html` (no title, no viewport, noindex) scores < 40 and has `indexable` fail; `inspect_html` captcha still → couldn't check |
| `test_signals.py` | Detects tel near the top, a form with email/phone, Calendly, Tawk chat, license number, BBB badge; the leadconnector rule from 6.3(b) |
| `test_pagespeed.py` | Keep the old PageSpeed tests; `parse_lighthouse_report` on a trimmed fixture (save a ~30 KB trimmed copy of a real Lighthouse JSON: categories plus the audits used); `speed_check` falls back to local when the API fails; nbsp replaced |
| `test_maps.py` | `parse_place_panel` on a saved panel text fixture (use the Moran text from section 2); `parse_card` with "4.4(19)" and multi-line formats; `listing_check` with a fake session: rank, competitors, market average, grid summary; a session raising an error → couldn't check |
| `test_ai.py` | Keep the old fallback tests (update for new prompts); `parse_answer` extracts names and detects a mention with a fuzzy match |
| `test_scoring.py` | Weights; a category that wasn't checked is excluded; grades; `listing_score` edge cases |
| `test_findings.py` | Each rule fires from a crafted item; scenario only with both numbers; inputs labeled; services ranking; AI Transformation added at 3+ |
| `test_summary.py` | The guard rejects invented numbers, URLs and length; template fallback text |
| `test_pipeline.py` | End to end with all fakes: result keys exactly as in 5.1; determinism; FL rejected; operator has no answers; phantomreach boundary |
| `test_api.py` | submit → 202 plus a queued record; idempotent repeat → 200 with the same run_id; daily cap → 429; bad key → 401; callback host not allowed → 422; status 404; signed report link valid, expired and tampered |
| `test_callback.py` | Signature matches; retries on 500 then succeeds; gives up after 4 tries; never retries on 4xx except 408 and 429 |
| `test_report.py` | `build_view` escapes `<script>` in a business name; the free view caps findings and includes the locked box; the full view has the grid and no locked box; the HTML has no `http` URLs except the source links and the Cal link (no external assets); a golden test that the HTML contains every section heading. PDF rendering is skipped unless `AUDIT_TEST_PDF=1` |

---

## 15. Tasks, in order (one commit each)

**T1. Tidy the check modules.** Apply all the fixes in 6.1-6.6. Add `test_net`, `test_crawl`, `test_seo`, `test_signals`, `test_maps`, `test_ai` and the speed tests.
*Done when:* those tests pass.

**T2. Pipeline.**
- Create `pipeline.py` (section 5) and reduce `service.py` to `parse_request` plus constants. Move the OpenRouter helpers into `pipeline.py`.
- Delete `geocode.py`, `geogrid.py`, `audit/web/` and their tests.
- Update `parse_request` for the new fields and validation (4.1).
- Add `summary.py` (section 9) and the scoring and findings fixes (7.2, 8).
- Write `test_scoring`, `test_findings`, `test_summary` and `test_pipeline`.

*Done when:* `pipeline.execute` runs end to end on fakes and all tests pass.

**T3. API, store, callback and Modal app.**
- `store.py`, `callback.py`, `api.py`, the new `app.py` (section 12) and `local_server.py`. In `local_server.py`, a background thread stands in for `spawn`; use `MemoryStore` and the folder `AUDIT_REPORT_DIR`.
- Write `test_api` and `test_callback`.

*Done when:* tests pass and `python3 -m audit.local_server` accepts a POST and returns 202, then the status reaches done (with fakes via `AUDIT_FAKE_DEPS=1`, a switch only `local_server` reads).

**T4. Report assets and charts.** Copy the fonts and logos into `audit/report/assets/`. Write `charts.py` and `copy.py`.
*Done when:* a quick script writes each chart to `/tmp` and they render in Chromium. Take a screenshot of a page with all charts and look at it.

**T5. Report template and view.** `template.html`, `styles.css`, `build_view`, `render_html`, both editions, per sections 10.1-10.3. Write `test_report` (HTML only).
*Done when:*
- tests pass
- you render a free and a full report from a fake result to HTML, open them in Chromium at 1280 px, screenshot every page and look at them
- nothing overlaps, there's no empty page, and nothing is cut at a page edge

**T6. PDF.** `render_pdf` with the footer template, wired into the worker: write the files, sign the links, return the `report` block.
*Done when:*
- with `AUDIT_TEST_PDF=1`, the PDF test passes
- you convert the free and full sample PDFs to PNGs (`pdftoppm -r 60` if available, or Playwright screenshots of the HTML in print media) and check every page visually: fonts loaded (not Times), colors present, no page with only a footer

**T7. Live run script.** Replace `audit/acceptance.py` with `audit/scripts/run_local.py <website> --name --city --state --industry --phone --mode free|full [--answers '{json}'] --out audit/samples/<slug>`. It runs `pipeline.execute` with live deps (no Modal, no callback) and writes `result.json`, `report.html` and `report.pdf`. Update `live_probe.py` imports or delete it if `run_local.py` covers it.
*Done when:* it runs against https://www.kyneticai.com in free mode.

**T8. Sample reports.** Run `run_local.py` for:
- PRI-Premiere Roofing: https://pripremiereroofing.com, Livermore CA, "roofing contractor", free and full
- Moran Roofing & Inspection: https://moranroofing.com, Livermore CA, free and full
- Maciel Roofing Construction: https://www.macielroofing.com, Hayward CA, free (expect the crawl to show couldn't check; that's a valid test of honest failure)

Use no answers for these, so no scenario is shown and the Operations category reads "not scored". Also do one extra run of Moran with sample answers `{"monthly_leads":"20-50","avg_job_value":"$12,000","after_hours":"voicemail, we call back next day","follow_up":"manual"}`. Label it `samples/moran-with-answers/` and add a README line saying these are invented demo answers, not Moran's.

Cross-check each sample against `audit/examples/sources.json`, and list any disagreement in `audit/samples/README.md` with both values. For example, a review count on the site vs on Google: both are fine, but the report must say which source.

*Done when:*
- 6 sample folders exist
- every page has been visually reviewed (screenshots)
- `samples/README.md` has the date, what ran, what couldn't be checked and why, and the cross-check notes

**T9. Docs.** Section 13: `docs/audit/n8n-contract.md`, the rewritten `audit/DEPLOY.md`, and the status update in `docs/coordinator/free-audit.md`.
*Done when:* the files exist and every env var and payload field in them matches the code.

**T10. Final check.**
- Run the full test suite.
- `python3 -m compileall audit`.
- Grep for `print(` of any env var, and for `OPENROUTER_API_KEY`/`GOOGLE_PAGESPEED_API_KEY` values in output. There must be none.
- Push.
- Report to Abdullah: what was built, the sample report paths, which checks couldn't run in samples and why, and the exact deploy steps that need his yes (Modal secrets, `modal deploy`, n8n workflows).

---

## 16. Acceptance (what "done and perfect" means)

1. One `POST /audit` returns 202 in under 2 seconds. The callback arrives within about 2 minutes (free) or about 5 minutes (full) with signed report links that open without a key.
2. Every number in the report traces to a tool and a source listed in the appendix. Nothing is invented. Every "couldn't check" shows its reason.
3. The free report:
   - is 6-10 pages
   - has a score, category bars and top priorities
   - has one section per tool, each with what it checked, what it found and the fix
   - has the services and the CTA
4. The full report adds the ranking grid, the site-wide scan, all findings and the 90-day plan.
5. It's on brand: Kynetic palette and fonts, flat colors, readable at print size, and it passes the contrast check.
6. Tests pass with no network. The 6 sample reports are committed and reviewed.
7. Nothing is deployed and nothing is sent until Abdullah approves.

---

## 17. Later: paid upgrades (not in this build)

Each one will be an optional check behind an env flag plus a per-audit cost cap, with the free path kept as a fallback and the cost logged in `cost_cents`. Abdullah's estimates, not checked against current pricing:
- Google Places API (about $0.02-0.05). Note: Google may have a monthly free allowance; check it before assuming it costs anything.
- DataForSEO local grid and keywords ($0.10-1)
- A paid model for the write-up ($0.10-0.50)
- Live AI answer checks via Perplexity or OpenAI search ($0.05-0.20)
- Bright Data scraping ($0.10-1)

Paid checks run only on the full edition or on ideal-client leads. Going paid changes the free-tier rule, so it needs Abdullah's yes.

## 18. Open risks (tell Abdullah, don't solve alone)

- **Google Maps scraping** is against Google's terms of service and can be blocked from Modal IPs at any time. The check degrades to "couldn't check". Places API is the clean upgrade.
- **Signed-out limited view:** Google sometimes hides review counts. The report then shows rating only.
- **OpenRouter free models** come and go and rate-limit. The AI check and summary fall back honestly.
- **PageSpeed** needs a free API key in the Modal secret, or every run uses the slower local Lighthouse (about 35 s extra).
- **Missing form fields:** the current site application doesn't collect city, state or industry. n8n has to ask or derive them before calling the audit.
