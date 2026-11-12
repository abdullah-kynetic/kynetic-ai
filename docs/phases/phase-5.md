# Phase 5: AI layer through OpenRouter (about 5 to 6 days)

Goal: model-backed features that draft, classify and summarize, all through OpenRouter, with cost metering and a person approving anything customer-facing.

The portal has no model client, key or prompt today. All of this is new.

## Scope

- `adapters/llm/` with a real OpenRouter adapter and a fake one (as `adapters/voice`, `sms` and `email` do), so CI never calls a model.
- One model map in config, per task. Cheap models for sorting and summarizing, a stronger one where a wrong answer costs money. Models are chosen by a small test set of real cases, not by guess, and swapped without code changes.
- Cost metering: each call records its cost, shown on `/admin/usage`, with a per-client monthly cap that stops further calls.
- Switches: `LLM_ENABLED=false` by default, and a data-handling setting on every request. Check OpenRouter's current data-retention options before any real client data is sent.
- Audit: every prompt and output that touches a client record is logged with who approved it.
- Features, in order: call summaries and outcome tags; message drafts (draft only, goes through the consent gate); lead research brief (strong evidence writes, weak evidence becomes a suggestion a person accepts).

Rule: a model never decides consent, quiet hours, DNC or whether a call is allowed. Those stay in code.

## Acceptance checks

| ID | Check | Proof |
|---|---|---|
| P5-1 | CI makes no network call to a model | the fake adapter is the only one used in tests |
| P5-2 | A call is metered and its cost shows on `/admin/usage` | integration test |
| P5-3 | A client over its cap gets no further model calls and the admin is told | integration test |
| P5-4 | With `LLM_ENABLED=false` nothing calls a model | unit test |
| P5-5 | Model output can never change consent, DNC or quiet-hours state | test that tries it and fails |
| P5-6 | Each feature passes its test set of real cases against the chosen model | eval run recorded in the report |
| P5-7 | Customer-facing output is a draft until a person approves it, and the approval is audited | integration test |

## Needs a yes

Deploy; adding the OpenRouter key; turning `LLM_ENABLED` on; sending any real client data to a model.

## Needs a decision

Default monthly AI spend cap per client (recommendation: low default, raised by hand).
