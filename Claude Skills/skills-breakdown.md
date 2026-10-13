# Claude Skills Breakdown

Reference guide for skill notes in this repo. Use this file to determine which skills are needed for any given task.

Kynetic delivery skills (`brand-profile`, `retell-builder`, `build-log`) live only in `.claude/skills/`. The duplicate copy under `Claude Skills/_kynetic/` was removed.

Empty `.gitkeep` skill folders (`n8n-code-python`, `n8n-expression-syntax`, `n8n-mcp-tools-expert`, `n8n-node-configuration`, `n8n-validation-expert`, `n8n-workflow-patterns`, `web-artifacts-builder`) were removed. The writeups below are the reference for those topics. Skills that still have their own files: `n8n-code-javascript`, `frontend-design`, `deep-research`, `brand-profile-generator`, `demo-profile-generator`.

---

## How to Use This File

When given a task, scan the **Trigger Signals** column for each skill. If a task matches one or more signals, invoke that skill before proceeding. Multiple skills often activate together — for example, building an n8n workflow typically involves `n8n-workflow-patterns` + `n8n-mcp-tools-expert` + `n8n-node-configuration` + `n8n-validation-expert`.

---

## Skill Index

| Skill | One-Line Summary |
|-------|-----------------|
| **n8n Skills** | |
| [n8n-mcp-tools-expert](#n8n-mcp-tools-expert) | Master guide for using the n8n MCP tools to search, configure, and manage workflows |
| [n8n-workflow-patterns](#n8n-workflow-patterns) | Architectural patterns for designing n8n workflows from scratch |
| [n8n-node-configuration](#n8n-node-configuration) | Operation-aware guidance for correctly configuring any n8n node |
| [n8n-validation-expert](#n8n-validation-expert) | Interpret and fix validation errors on nodes and workflows |
| [n8n-expression-syntax](#n8n-expression-syntax) | Write and debug `{{}}` expressions in n8n workflow fields |
| [n8n-code-javascript](#n8n-code-javascript) | Write JavaScript inside n8n Code nodes |
| [n8n-code-python](#n8n-code-python) | Write Python inside n8n Code nodes |
| **Web & Design** | |
| [frontend-design](#frontend-design) | Create distinctive, production-grade frontend interfaces |
| [web-artifacts-builder](#web-artifacts-builder) | Build elaborate HTML artifacts using React + Tailwind + shadcn/ui |
| **Research & Knowledge** | |
| [deep-research](#deep-research) | Multi-source research with citation tracking and structured report generation |

---

## n8n-mcp-tools-expert

**What it does:** Acts as a master guide for every tool the n8n MCP server exposes — node search, node info retrieval, validation, template browsing, and workflow CRUD operations. Covers correct parameter formats, tool selection decisions, and the iterative workflow-building loop.

**When to call it:**
- Searching for a node by name or functionality (`search_nodes`)
- Retrieving node schema or documentation (`get_node`)
- Validating a node config or full workflow (`validate_node`, `validate_workflow`)
- Creating, updating, or activating a workflow via API
- Browsing or deploying from the 2,700+ template library
- Unsure which MCP tool to use for a given action

**Key patterns it covers:**
- `search_nodes` → `get_node` → `validate_node` → build loop
- Short (`nodes-base.*`) vs full (`n8n-nodes-base.*`) nodeType prefix rules
- Smart connection parameters (`branch`, `case`) for IF/Switch nodes
- `intent` parameter usage in workflow updates
- Template search modes (`by_nodes`, `by_task`, `by_metadata`)

**Works alongside:** All other n8n skills — this is the tooling layer that the others depend on.

---

## n8n-workflow-patterns

**What it does:** Provides 5 proven architectural patterns for structuring n8n workflows, drawn from real workflow analysis. Covers trigger types, data flow shapes, error handling strategies, and component selection for each pattern.

**When to call it:**
- Starting a new workflow from scratch
- Deciding how to structure a workflow (linear vs branching vs parallel)
- Choosing between trigger types (webhook vs schedule vs manual)
- Building any of these use cases:
  - Webhook processing (form submissions, payment hooks, Slack commands)
  - HTTP API integration (fetching/syncing with third-party APIs)
  - Database operations (ETL, sync, scheduled queries)
  - AI agent workflows (chatbots, reasoning + tool use)
  - Scheduled tasks (daily reports, recurring automation)
- Planning error handling for a workflow

**The 5 patterns:**
1. **Webhook Processing** — Webhook → Validate → Transform → Respond/Notify
2. **HTTP API Integration** — Trigger → HTTP Request → Transform → Action → Error Handler
3. **Database Operations** — Schedule → Query → Transform → Write → Verify
4. **AI Agent Workflow** — Trigger → AI Agent (Model + Tools + Memory) → Output
5. **Scheduled Tasks** — Schedule → Fetch → Process → Deliver → Log

**Works alongside:** `n8n-mcp-tools-expert` (find nodes), `n8n-node-configuration` (configure them), `n8n-validation-expert` (validate before deploy).

---

## n8n-node-configuration

**What it does:** Provides operation-aware guidance for configuring any n8n node correctly. The key insight: required fields differ by operation (e.g., Slack `post` needs `channel` + `text`, but `update` needs `messageId`). Covers property dependency rules (`displayOptions`), progressive discovery strategy, and common per-node patterns.

**When to call it:**
- Configuring a node for a specific operation (resource + operation combination)
- A field you expected is missing or not showing up
- A validation error says a field is required but you don't know which one
- Choosing between `get_node` detail levels (standard vs full vs search_properties)
- Working with HTTP Request (method-dependent body fields), IF/Switch (binary vs unary operators), or database nodes (operation-specific requirements)

**Key rules:**
- Start with `get_node({detail: "standard"})` — covers 95% of needs
- Only escalate to `detail: "full"` when standard isn't enough
- Use `mode: "search_properties"` to locate a specific hidden field
- Configure minimal first, then add fields as validation requires

**Works alongside:** `n8n-mcp-tools-expert` (the actual tool calls), `n8n-validation-expert` (catch what's still wrong after configuring).

---

## n8n-validation-expert

**What it does:** Guides the iterative validation loop — reading errors, choosing the right validation profile, distinguishing real errors from false positives, and using auto-sanitization correctly. Covers both node-level and full workflow validation.

**When to call it:**
- After configuring a node and before deploying
- Encountering a validation error you don't understand
- Deciding whether to use `minimal`, `runtime`, `ai-friendly`, or `strict` profile
- Encountering operator structure issues (IF/Switch nodes, `singleValue` problems)
- Workflow has broken connections or stale references
- Deciding whether a warning is a real problem or a false positive

**Error types it covers:**
- `missing_required` — add the missing field
- `invalid_value` — use an allowed option
- `type_mismatch` — fix the data type (string vs number)
- `invalid_expression` — missing `{{}}` or bad reference
- `invalid_reference` — node name typo or doesn't exist

**Auto-sanitization:** Runs automatically on every workflow save. Fixes binary/unary operator structures and IF/Switch metadata. Cannot fix broken connections — use `cleanStaleConnections` for those.

**Profile guide:**
- `runtime` — default, use for pre-deployment
- `ai-friendly` — fewer false positives for AI-generated configs
- `strict` — production critical workflows only
- `minimal` — fast check during active editing

**Works alongside:** `n8n-node-configuration` (know what to configure), `n8n-mcp-tools-expert` (run the actual validate calls), `n8n-expression-syntax` (fix expression errors).

---

## n8n-expression-syntax

**What it does:** Validates and teaches correct `{{}}` expression syntax used in n8n workflow fields (not Code nodes). Covers variable access patterns, the critical webhook `.body` nesting issue, node references, date formatting, and common mistakes.

**When to call it:**
- Writing any `{{ }}` expression in a workflow field
- Expression is showing as literal text instead of evaluating
- Getting "Cannot read property of undefined" errors in expressions
- Accessing data from a webhook (critical: data is under `$json.body`, not `$json`)
- Referencing another node's output with `$node["Node Name"]`
- Using `$now` for date/time in expressions
- An expression works in some fields but not others

**Critical rules:**
- Always wrap in `{{ }}` — bare `$json.field` is literal text
- Webhook data lives at `$json.body.field`, not `$json.field`
- Node names with spaces require quotes: `$node["HTTP Request"]`
- Node names are case-sensitive
- Do NOT use `{{ }}` inside Code nodes — use direct JavaScript/Python there

**Works alongside:** `n8n-validation-expert` (expression errors surface in validation), `n8n-code-javascript` / `n8n-code-python` (know when to use expressions vs code).

---

## n8n-code-javascript

**What it does:** Expert guidance for writing JavaScript inside n8n Code nodes. Covers the two execution modes, all data access patterns (`$input.all()`, `$input.first()`, `$input.item`, `$node`), required return format, built-in helpers (`$helpers.httpRequest`, `DateTime`, `$jmespath`), and the top 5 mistakes.

**When to call it:**
- Writing JavaScript in any n8n Code node
- Deciding between "Run Once for All Items" vs "Run Once for Each Item" mode
- Making HTTP requests from within a Code node
- Working with dates/times in code (`DateTime` / Luxon)
- Aggregating, filtering, or transforming data across multiple items
- Parsing complex API responses
- A Code node is throwing an error

**Critical rules:**
- Always return `[{json: {...}}]` — never a plain object, never a raw array
- Webhook data is at `$json.body.field`, not `$json.field`
- Do NOT use `{{ }}` expression syntax inside Code nodes — use `$input.first().json.field` directly
- `$input.all()` for "All Items" mode; `$input.item` for "Each Item" mode

**Use Code node when:** complex multi-step logic, aggregation across items, custom calculations, recursive ops. Use Set/Filter/IF nodes for simple field mapping and basic conditionals.

**Works alongside:** `n8n-expression-syntax` (for fields outside Code nodes), `n8n-node-configuration` (Code node mode/language config), `n8n-validation-expert` (validate the Code node config).

---

## n8n-code-python

**What it does:** Same as the JavaScript skill but for Python Code nodes. Covers `_input`/`_json`/`_node` syntax, Python (Beta) vs Python (Native) modes, standard library availability, the critical limitation of no external packages, and the top 5 Python-specific mistakes.

**When to call it:**
- Writing Python in an n8n Code node
- Preferring Python syntax for data transformations or regex work
- Using `statistics`, `datetime`, `re`, `json`, `hashlib`, `base64`, or `urllib.parse` from the standard library
- Deciding whether to use Python or JavaScript (default: JavaScript)

**Critical limitation:** No external libraries. `requests`, `pandas`, `numpy`, `BeautifulSoup` are all unavailable. If you need HTTP requests, use `$helpers.httpRequest()` in JavaScript or add an HTTP Request node before the Code node.

**Python vs JavaScript decision:**
- Use JavaScript for 95% of cases — better n8n integration, Luxon for dates, `$helpers.httpRequest()`
- Use Python when you need specific standard library functions or strongly prefer Python syntax

**Works alongside:** All the same skills as `n8n-code-javascript`.

---

## frontend-design

**What it does:** Creates distinctive, production-grade frontend interfaces that avoid generic AI aesthetics. Focuses on intentional typography, cohesive color, strategic animation, and spatial composition.

**When to call it:**
- Building any React/Tailwind/CSS frontend component or page
- Designing a UI with a specific aesthetic direction
- Making a UI "look premium", "match a brand", or "avoid generic AI design"
- Any frontend task where design quality matters alongside functionality

**Key focus areas:** Typography (distinctive typefaces, deliberate pairing), Color & motion (CSS variables, strategic animation), Spatial composition (asymmetry, overlap, diagonal flow), Visual atmosphere (textures, gradients, custom patterns).

**Avoid:** Inter font as default, purple gradients, uniform border-radius, predictable centered layouts.

**Works alongside:** `web-artifacts-builder` (artifacts)

---

## web-artifacts-builder

**What it does:** Builds elaborate, multi-component Claude.ai HTML artifacts using React 18 + TypeScript + Tailwind CSS + shadcn/ui, bundled into a single self-contained HTML file via Parcel.

**When to call it:**
- Building a Claude.ai artifact (interactive HTML)
- Creating a multi-component React UI for in-chat display
- Asked to "build an artifact", "create an interactive demo", or "make an HTML app"
- Building dashboards, calculators, visualizations, or tools that run in the browser

**Workflow:** `scripts/init-artifact.sh` → develop in `src/` → `scripts/bundle-artifact.sh` → single HTML → display.

**Works alongside:** `frontend-design` (design direction)

---

## deep-research

**What it does:** Conducts multi-source research with citation tracking and produces comprehensive, structured reports (executive summary, 4–8 cited findings, bibliography). Selects from Quick/Standard/Deep/Ultradeep modes based on complexity.

**When to call it:**
- Asked for "deep research", "comprehensive analysis", or a "research report"
- Comparing options in depth, trend analysis, state-of-the-art reviews
- Any task requiring 10+ sources and a formal report structure
- **NOT for:** simple lookups, debugging, single-question answers

**Quality standards:** 10+ sources, 3+ per claim, all statements cited, no fabricated references, 80%+ prose.

**Works alongside:** `tavily-mcp` (web search), `firecrawl` (page extraction), `context7` (technical docs)

---

## Quick Lookup: Task → Skills

| Task | Skills to invoke |
|------|-----------------|
| Build a new n8n workflow | `n8n-workflow-patterns` + `n8n-mcp-tools-expert` |
| Configure a specific node | `n8n-node-configuration` + `n8n-mcp-tools-expert` |
| Fix a validation error | `n8n-validation-expert` + `n8n-mcp-tools-expert` |
| Write `{{ }}` in a field | `n8n-expression-syntax` |
| Write code in a Code node (JS) | `n8n-code-javascript` |
| Write code in a Code node (Python) | `n8n-code-python` |
| Full workflow build end-to-end | All 7 n8n skills |
| Webhook-triggered workflow | `n8n-workflow-patterns` + `n8n-expression-syntax` + `n8n-mcp-tools-expert` |
| AI agent workflow | `n8n-workflow-patterns` + `n8n-mcp-tools-expert` + `n8n-node-configuration` |
| Debug a broken workflow | `n8n-validation-expert` + `n8n-expression-syntax` |
| Build a Claude.ai HTML artifact | `web-artifacts-builder` + `frontend-design` |
| Frontend UI with strong aesthetics | `frontend-design` |
| Deep research with cited report | `deep-research` |
