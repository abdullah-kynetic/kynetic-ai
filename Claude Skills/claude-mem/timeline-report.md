# /timeline-report

Generate a comprehensive narrative analysis of a project's development history using claude-mem's persistent memory timeline. Produces a "Journey Into [Project]" report.

## When to Call It

- Understanding how a project evolved over multiple sessions
- Retrospective analysis before a major refactor or handoff
- Quantifying memory ROI and token economics for a project
- Onboarding someone to a project's history without re-explaining everything

## Report Sections (Required)

1. **Project Genesis** — founding vision and initial technical decisions
2. **Architectural Evolution** — structural changes and pivots over time
3. **Key Breakthroughs** — decisive "aha moments" and problem resolutions
4. **Work Patterns** — development rhythm, sprints, refactoring cycles
5. **Technical Debt** — shortcuts taken and their resolution timeline
6. **Challenges** — multi-session debugging efforts and dead-ends
7. **Memory & Continuity** — how persistent memory affected development
8. **Token Economics & Memory ROI** — quantitative savings via SQLite database queries
9. **Timeline Statistics** — observation counts, date ranges, activity breakdowns
10. **Lessons & Meta-Observations** — patterns for future developers

## Output

Saved as `./journey-into-PROJECT_NAME.md`. Target: 3,000–6,000 words depending on project scope. Narrative prose with specific timestamps and structured data.

## Requires

claude-mem installed with the worker daemon active. The complete compressed timeline is fetched via API call to the worker (~20–50K tokens for small projects, up to ~300–750K for large ones).
