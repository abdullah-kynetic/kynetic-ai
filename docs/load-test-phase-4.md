# Phase 4 load test (2026-11-13)

Acceptance check P4-3: contact search p95 under 500 ms at 100 concurrent (DC-033), run without the CI override.

**Method.** `tests/integration/load-m10.test.ts` from `crm/`, with `LOAD_P95_MS` unset so the limit is the product target of 500 ms. It builds a disposable Postgres 16 database, loads 10,000 contacts for one client, and runs 100 searches at concurrency 20 and at concurrency 100 through the app role (row-level security on) and an app-sized connection pool (`max=10`). A second test runs 100 default list reads (50 rows per page, pages 1 to 5, newest activity first) at concurrency 100.

**Machine.** A 4-vCPU cloud container with Postgres, the app code and the load generator all on the same four cores, idle otherwise (load average about 1). This is not a dedicated quiet machine. Local only; nothing was run against the live portal.

## Result

Search p95 at concurrency 100, five consecutive runs after the change: **371, 417, 389, 411, 382 ms**. All under 500 ms. Concurrency 20: 127 to 158 ms.

Before the change, three runs on the same machine: **737, 756, 699 ms**, which failed the target.

**What changed.** `searchContacts` scanned the contacts table twice for every filtered search, once to count and once to fetch the page. With a search term both scans are full scans (the planner correctly prefers a sequential scan at 10,000 rows). The total now rides on the page query as `count(*) over ()`, so a filtered search scans once. The unfiltered list keeps its own count, because there the page stops early on an index. A page past the end still counts separately. Results are identical (`tests/integration/contacts-list.test.ts` and the other contact tests pass).

**Tried and dropped.** A trigram index on the email column and an index matching the default list order (`updated_at DESC NULLS LAST, id`). Neither changed the measured time at 10,000 contacts (the planner uses a sequential scan at that size, and the list page was already 0.1 ms), so neither was shipped.

## List path (not met, recorded as KI-040)

Default contact list, concurrency 100, five runs: p95 **501 to 552 ms** (p50 about 290 ms). Just over the 500 ms target on this machine. About 7 ms of each read is the row count under row-level security. The regression guard in the test is 750 ms. Deeper pages and sorting by name are slower still (sorting by name has no index and orders every row; measured 630 to 690 ms at concurrency 100).

## Not verified

- Run on the production-class server (VPS) or a dedicated quiet machine. The check says "on a quiet machine"; the numbers above are from a shared container, so a pass here is evidence, not the final proof. Rerun there when a server session is available.
- Anything above 10,000 contacts per client, or several clients at once. Real traffic is nowhere near 100 simultaneous searches from one client; this is a worst-case shape.
