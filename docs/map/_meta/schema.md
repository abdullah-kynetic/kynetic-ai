# Schema: closed node types for this map

| `type:` | Lives at | Carries |
|---|---|---|
| object | `objects/<cluster>/<slug>.md` | a noun: shape, why, connections, Hits / Does not hit |
| process | `processes/<slug>.md` | a movement that actually runs, with consumes / produces |

Frontmatter on every card: `type`, `cluster`, `universe` (live | leftover | ghost), `status` (stub | verified | stale), `entity` (owning path), and for verified cards `verified_on` and `verified_at` (commit).
Names: kebab-case slugs. Clusters: alex, lead, n8n, retell, portal, docs, frozen, tooling.
Index `objects/_index.md` is hand-kept until a script exists; if it drifts, regenerate rather than patch.
