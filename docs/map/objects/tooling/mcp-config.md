---
type: object
cluster: tooling
universe: live
status: verified
entity: .mcp.json
verified_on: 2026-10-22
verified_at: 5888b13 (source unchanged since 67763e6)
---

# MCP config and env names

`.mcp.json` starts three servers via `npx -y <pkg>@latest` (tavily, firecrawl, retell), each taking a key from the environment. `.env.example` lists names only (Retell, Cal, Tavily, Firecrawl, Twenty, and now n8n).

## If you change this
- **Hits:** [[retell-client]] (key loading), the cloud environment variable list. Unpinned `@latest` means servers change without a commit.
