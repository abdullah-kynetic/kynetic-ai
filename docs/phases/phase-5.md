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

## Steps

Work these in order. Tick each `- [ ]` as `- [x]` in the same commit that finishes the step. A new thread resumes at the first unticked step. For every step: finish it, test it, commit, push, then move on (see `PROTOCOL.md`). A STOP step waits for Abdullah's yes; do the steps after it that do not depend on it.

- [x] **P5-S1.** `adapters/llm/` interface with a fake adapter, `LLM_ENABLED=false` default, and a data-handling setting on every request.
  - Test: Unit test: disabled means no call; CI uses only the fake
  - Commit: "Add the LLM adapter interface and fake"
  - Covers: P5-1, P5-4
- [x] **P5-S2.** Real OpenRouter adapter and the per-task model map in config.
  - Test: Unit tests with a mocked transport (no network)
  - Commit: "Add the OpenRouter adapter"
  - Covers: P5-1
- [ ] **P5-S3.** Cost metering into the usage ledger, shown on `/admin/usage`, with the per-client monthly cap.
  - Test: Integration tests: metered and shown; over cap stops calls and tells the admin
  - Commit: "Meter and cap model usage"
  - Covers: P5-2, P5-3
- [ ] **P5-S4.** Audit log of every prompt and output that touches a client record, with who approved it.
  - Test: Integration test
  - Commit: "Audit model prompts and outputs"
  - Covers: P5-7
- [ ] **P5-S5.** Test that model output can never change consent, DNC or quiet hours.
  - Test: Test that tries it and fails
  - Commit: "Test the model cannot change compliance state"
  - Covers: P5-5
- [ ] **P5-S6.** Feature 1: call summaries and outcome tags.
  - Test: Eval set of real cases against the chosen model
  - Commit: "Add call summaries"
  - Covers: P5-6
- [ ] **P5-S7.** Feature 2: message drafts (draft only, through the consent gate).
  - Test: Eval set and integration test
  - Commit: "Add message drafts"
  - Covers: P5-6, P5-7
- [ ] **P5-S8.** Feature 3: lead research brief (strong evidence writes, weak becomes a suggestion).
  - Test: Eval set
  - Commit: "Add lead research brief"
  - Covers: P5-6
- [ ] **P5-S9.** Open PR; record in the build log. STOP for yes: add the OpenRouter key, turn `LLM_ENABLED` on, send real client data; also a decision on the default monthly cap.
  - Test: CI green
  - Commit: "Record phase 5 in the build log"
  - Covers: -
