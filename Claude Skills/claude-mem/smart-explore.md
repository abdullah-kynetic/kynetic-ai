# /smart-explore

Token-optimized structural code navigation using tree-sitter AST parsing. Read structure first, full source only when needed.

## When to Call It

- Navigating an unfamiliar codebase
- Finding where a function or class is defined
- Getting a structural overview before reading files in full
- Reducing token usage during codebase exploration

## Three Functions

| Function | What it returns | Tokens |
|----------|----------------|--------|
| `smart_search` | Ranked symbols with signatures + line numbers | 2–6k |
| `smart_outline` | Structural skeleton of one file (functions, classes, imports) | 1–2k |
| `smart_unfold` | Full source of one specific symbol | 400–2,100 |
| Read (full file) | Everything | 12,000+ |

**Rule:** Always `smart_search` → `smart_outline` → `smart_unfold`. Never read a full file before checking the outline first.

## Supported Languages

JavaScript, TypeScript, Python, Go, Rust, Ruby, Java, C/C++ (bundled). Custom grammars via `.claude-mem.json`.

## Requires

claude-mem installed (tree-sitter grammars are bundled with the plugin).
