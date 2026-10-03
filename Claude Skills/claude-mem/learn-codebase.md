# /learn-codebase

Thoroughly onboard to an unfamiliar codebase by reading every source file in full before beginning any development work.

## When to Call It

- Starting work on a new or unfamiliar project
- Explicitly asked to "learn the codebase" or "get up to speed"
- Before running `/pathfinder` or `/make-plan` on a project you haven't touched before

## Core Approach

Read **every source file in full** — no skipping, no sampling. This is a front-loaded investment that reduces token usage and errors across the entire project lifetime.

For large files, paginate: use `offset` and `limit` parameters in chunks of ~500 lines at a time.

## Why This Matters

Skimming creates gaps. A missed initialization pattern or an undocumented constraint discovered mid-implementation breaks plans and wastes far more tokens than the upfront read cost. This skill trades tokens now for accuracy later.

## Works Alongside

`smart-explore` (use after learning to navigate efficiently), `pathfinder` (audit architecture after learning), `make-plan` (plan confidently once you know the codebase).
