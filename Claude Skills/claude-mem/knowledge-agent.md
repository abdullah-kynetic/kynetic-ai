# /knowledge-agent

Build focused, queryable AI knowledge bases from memory observation histories. Create a "brain" scoped to a specific topic or project area.

## When to Call It

- "What do we know about [specific subsystem]?"
- Compiling everything ever observed about hooks, auth, a specific client workflow, etc.
- Creating a reusable knowledge corpus for a recurring domain

## Workflow

1. **Build** — filter observations by project name, concept tags, file paths, or date ranges
2. **Prime** — load the compiled corpus into an AI session
3. **Query** — ask conversational questions answered from corpus knowledge
4. **List** — view all available corpora with stats

## Key Principle

Focused corpora beat broad ones. "Everything about the voice agent flow" outperforms "everything ever." Prime once, query multiple times. Reprime to reset Q&A context while keeping the corpus.

## Maintenance

- **Rebuild** — refresh corpus when new observations have been added
- **Reprime** — fresh session, same corpus

## Requires

claude-mem installed with ChromaDB vector database active.
