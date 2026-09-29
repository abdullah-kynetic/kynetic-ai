# Graphify Skill

Transform unstructured files (code, PDFs, markdown, images) into interactive knowledge graphs. Extracts concepts and relationships, visualizes connections, and produces structured reports.

## When to invoke this skill

- Mapping relationships across a large codebase or document corpus
- Understanding connections between concepts in research papers or docs
- Building a knowledge graph from a collection of files
- Reducing token usage through graph-based context instead of raw files
- Asked to "map", "graph", "visualize relationships", or "connect concepts" across files

## What it produces

1. **Interactive HTML graph** — visual explorer with search and filtering
2. **Persistent JSON graph** — reusable across sessions, queryable
3. **Structured report** — identifies key concepts and surprising cross-connections
4. **Optional wiki** — auto-generated from graph nodes

## Supported input types

- Source code (any language)
- PDFs and research papers
- Markdown documents
- Images and diagrams (multimodal analysis)
- Screenshots

## Key benefits

- **Token efficiency** — claimed 71.5x reduction on large corpora vs raw file injection
- **Cross-session persistence** — graph builds up over time, doesn't reset
- **Git integration** — tracks changes and evolves graph as code changes

## Install

```bash
pip install graphifyy
```

Requires: Claude Code + Python 3.10+

## Usage

```bash
graphify --input ./src --output graph.json
graphify --input paper.pdf --visualize
```

## Works alongside

`deep-research` (graph knowledge from research sources), `codebase-memory-mcp` (alternative for pure code analysis).

## Source

https://github.com/safishamsi/graphify
