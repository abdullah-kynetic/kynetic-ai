# /do

Execute a phased implementation plan using subagents. You are the orchestrator — you coordinate and verify, subagents do the work.

## When to Call It

- Running a plan produced by `/make-plan`
- Executing any multi-phase implementation
- When work needs to be distributed across specialized subagents with verification at each step

## Execution Protocol

**Per phase:**
1. Deploy an "Implementation" subagent with one clear objective
2. Subagent copies from documentation — does not invent APIs or signatures
3. Subagent stops and flags if an expected API is missing
4. After completion, deploy "Verification" + "Anti-pattern Check" + "Code Quality Review" subagents
5. Only deploy "Commit" subagent after verification passes

**Between phases:**
Deploy a "Branch/Sync" subagent to push work and prepare context for the next phase.

## Failure Modes to Prevent

- Assuming APIs exist without documentation verification
- Using undocumented parameters or invented method signatures
- Skipping verification checklists
- Committing before verification passes (without explicit approval)
- Advancing phases before the previous phase is confirmed complete

## Works Alongside

`make-plan` (always plan before executing), `pathfinder` (map the codebase first on complex tasks), `smart-explore` (efficient navigation during implementation).
