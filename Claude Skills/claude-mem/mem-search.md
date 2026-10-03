# /mem-search

Search Claude's persistent cross-session memory database using a three-layer workflow optimized for token efficiency.

## When to Call It

- "Did we already fix this?"
- "How did we solve X last time?"
- "What patterns did we establish for [topic]?"
- Any question about previous session context

## Three-Layer Workflow

**Layer 1 — Search:** Query the index to get IDs and metadata (~50–100 tokens per result). Filter by project, type, observation category, date range.

**Layer 2 — Timeline:** Anchor to an observation ID and pull surrounding items chronologically. Configurable depth before and after the anchor.

**Layer 3 — Fetch:** Retrieve full details only for filtered IDs via batch request (500–1,000 tokens each).

**Efficiency rule:** Always filter before fetching. This achieves ~10x token savings vs. reading full observations directly.

## Key Filter Parameters

- `query` — search terms
- `project` — project name
- `type` — observation type: `bugfix`, `feature`, `decision`, `discovery`, `change`
- `date_range` — narrow to a time window
- `limit` — max results to return

## Requires

claude-mem installed and running (`~/.claude-mem` directory must exist with the worker daemon active).
