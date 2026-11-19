# MCP server implementation

Baseline: 614b7e40d3dc807a577d617c1c2ceda44b6ce427. Local stdio only; no deployment or portal contract changes.

1. Establish isolated package, SDK and validated environment-only client registry. Acceptance: no credentials in tool output or logs.
2. Implement the 15 existing read definitions, exact portal mappings, bounded requests and per-client KPI results. Acceptance: synthetic portal tests demonstrate isolation, pagination and error handling.
3. Implement the five existing writes with unchanged idempotency keys and replay responses. Acceptance: duplicate synthetic requests cause one effect and no outbound jobs.
4. Exercise initialization, listing and calls with a real MCP client; document installation and removal. Run build, unit/integration, typecheck/lint, portal verification and production build-context regression. Record exact SHA CI and gaps.

No ingest, consent-decision or unapproved audit route exposure; no migration expected. Parent owns review, integration and deployment.
