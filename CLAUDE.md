# Agent Instructions

You're working inside the **WAT framework** (Workflows, Agents, Tools). This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution. That separation is what makes this system reliable.

## The WAT Architecture

**Layer 1: Workflows (The Instructions)**
- Markdown SOPs stored in `workflows/`
- Each workflow defines the objective, required inputs, which tools to use, expected outputs, and how to handle edge cases
- Written in plain language, the same way you'd brief someone on your team

**Layer 2: Agents (The Decision-Maker)**
- This is your role. You're responsible for intelligent coordination.
- Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, and ask clarifying questions when needed
- You connect intent to execution without trying to do everything yourself
- Example: If you need to pull data from a website, don't attempt it directly. Read `workflows/scrape_website.md`, figure out the required inputs, then execute `tools/scrape_single_site.py`

**Layer 3: Tools (The Execution)**
- Python scripts in `tools/` that do the actual work
- API calls, data transformations, file operations, database queries
- Credentials and API keys are stored in `.env`
- These scripts are consistent, testable, and fast

**Why this matters:** When AI tries to handle every step directly, accuracy drops fast. If each step is 90% accurate, you're down to 59% success after just five steps. By offloading execution to deterministic scripts, you stay focused on orchestration and decision-making where you excel.

## How to Operate

**1. Look for existing tools first**
Before building anything new, check `tools/` based on what your workflow requires. Only create new scripts when nothing exists for that task.

**2. Learn and adapt when things fail**
When you hit an error:
- Read the full error message and trace
- Fix the script and retest (if it uses paid API calls or credits, check with me before running again)
- Document what you learned in the workflow (rate limits, timing quirks, unexpected behavior)
- Example: You get rate-limited on an API, so you dig into the docs, discover a batch endpoint, refactor the tool to use it, verify it works, then update the workflow so this never happens again

**3. Keep workflows current**
Workflows should evolve as you learn. When you find better methods, discover constraints, or encounter recurring issues, update the workflow. That said, don't create or overwrite workflows without asking unless I explicitly tell you to. These are your instructions and need to be preserved and refined, not tossed after one use.

## The Self-Improvement Loop

Every failure is a chance to make the system stronger:
1. Identify what broke
2. Fix the tool
3. Verify the fix works
4. Update the workflow with the new approach
5. Move on with a more robust system

This loop is how the framework improves over time.

## File Structure

**What goes where:**
- **Deliverables**: Final outputs go to cloud services (Google Sheets, Slides, etc.) where I can access them directly
- **Intermediates**: Temporary processing files that can be regenerated

**Directory layout:**
```
.tmp/           # Temporary files (scraped data, intermediate exports). Regenerated as needed.
tools/          # Python scripts for deterministic execution
workflows/      # Markdown SOPs defining what to do and how
.env            # API keys and environment variables (NEVER store secrets anywhere else)
credentials.json, token.json  # Google OAuth (gitignored)
```

**Core principle:** Local files are just for processing. Anything I need to see or use lives in cloud services. Everything in `.tmp/` is disposable.

## Bottom Line

You sit between what I want (workflows) and what actually gets done (tools). Your job is to read instructions, make smart decisions, call the right tools, recover from errors, and keep improving the system as you go.

Stay pragmatic. Stay reliable. Keep learning.

---

## Skills

At the start of every conversation, read `Claude Skills/skills-breakdown.md` and scan the **Trigger Signals** for each skill. If the task matches one or more triggers, invoke those skills before proceeding. Multiple skills often activate together — check the Quick Lookup table at the bottom of the file.

**Business-specific skills** (Kynetic AI) are in `Claude Skills/_kynetic/`. These are the primary skills for client delivery work — always check them first when the task is client-facing.

**claude-mem skills** are available in `Claude Skills/claude-mem/`. The memory-dependent ones (`/mem-search`, `/knowledge-agent`, `/timeline-report`) require the claude-mem system to be installed and running. The methodology skills (`/make-plan`, `/do`, `/pathfinder`, `/smart-explore`, `/learn-codebase`) work in any session without it.

## Default Methodology (Token-Efficient)

Follow the claude-mem methodology as the default approach for all work:

1. **Before touching any file:** Use `/smart-explore` (`smart_search` → `smart_outline` → `smart_unfold`). Never read a full file when a structural outline will do. This is the single biggest token saver.

2. **Before any non-trivial implementation:** Run `/make-plan`. Phase 0 (documentation discovery) is mandatory — never write code based on assumed APIs. Compile an "Allowed APIs" reference first.

3. **During implementation:** Run `/do`. Deploy subagents per phase, verify before advancing, never commit before verification passes.

4. **On an unfamiliar codebase or project:** Run `/learn-codebase` first, then `/pathfinder` to map architecture before planning anything.

**Use `task-master` only when** managing multiple clients or workstreams simultaneously and you need a persistent task backlog with dependencies tracked across sessions. It is not the default planning tool — `/make-plan` is.

**Use `superpowers` only when** the methodology layer is needed for TDD, git worktree workflows, or parallel agent dispatch — not for general planning.

---

## Kynetic context (read first)

Read `KYNETIC_CONTEXT.md` at the start of every session: approval rules, the frozen Nora
receptionist vs the Emily build copy, Twenty as the CRM, and all key IDs. Active build
handoffs live next to their build, e.g. `retell/builds/emily-speed-to-lead/HANDOFF.md`.

Retell access is `tools/retell.py` (stdlib Python, `RETELL_API_KEY` from env or `.env`);
it dry-runs every write unless `--apply` is passed. The Retell MCP needs Deno and is optional.
