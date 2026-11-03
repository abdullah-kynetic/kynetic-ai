# Local automation drafts

These files are not live workflow backups, are not in the import manifest, and must not be imported or activated automatically.

## M15-04 error alert (2026-11-01)

`m15-error-alert.js` is the draft Code node body (Run Once for All Items). It reads an Error Trigger execution failure, requires durable workflow/execution identifiers, drops recursive self-alerts and emits a fixed safe email body. It never carries a workflow name, error message, stack, input, credential, customer record, execution URL or transcript into email. Startup/trigger failures without an execution ID need a separate tested identity contract; this draft rejects them.

Planned graph: Error Trigger → safe formatter → durable dedupe/email dispatcher. The dispatcher must persist `(workflowId,executionId)` before/with delivery, use the same provider idempotency key on retries, and preserve failed/unknown delivery outcomes for review. Do not claim exactly-once delivery from a static-data map or from a formatter. A real recipient, sender and email credential will be configured only with Abdullah's specific yes. Provider idempotency expiry and unknown-outcome reconciliation must be defined before a real send.

Status: formatter locally tested with fake idempotent email delivery; full workflow not built or imported. The n8n connector returned internal errors for SDK reference, notification guidance and node type definitions on 2026-11-01. An importable graph cannot be validated until these are available. No credential lookup, workflow write, workflow execution or provider call was made. M15-04 remains blocked; a passing formatter test is not full acceptance.
