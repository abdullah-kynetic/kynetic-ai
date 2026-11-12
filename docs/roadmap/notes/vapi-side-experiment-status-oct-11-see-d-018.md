# [PARKED] Vapi side experiment: status (Oct 11) — see D-018

_Twenty note `f3e14365`, created 2026-10-11, updated 2026-10-14. Exported 2026-11-12._

**PARKED (D-018, Oct 13, 2026):** Retell is the platform. Nothing below is active work.

Retell stays main build and backup. Vapi is a side experiment. No platform decision was made at the time. (This note originally said "D-017"; that number was later used for pricing. The platform decision is now **D-018: Retell is the platform, Vapi parked**.)

**Live:** Vapi assistant 8e51e8d6 (v15), 5 tools, n8n workflow zeuXYovHQ4u75heS (4 paths incl. calendar lookup), published. Phone number is a placeholder; nothing can dial.

**Oct 11 test failed on prompt behavior** (stale dashboard tab gave blank name/company, plus Alex obeyed speech-change requests, accepted a 4 AM callback, repeated closing line without end_call, said he had no name, ignored tool errors). Fixes drafted in vapi-prompt-v3-DRAFT.txt, NOT applied.

**Known downgrade:** calendar webhook has no header auth (unguessable path only); returns open times only.

**Next:** apply v3, hard-refresh tab + set Variables, run 6-test script, re-secure calendar webhook, verify Twenty filters. Gated: phone number, counsel sign-off, AM-1 OK, voice, platform decision (now D-018: Vapi parked).

Full detail: docs/outbound-s2l-demo/HANDOFF.md on branch claude/charming-mayer-r934wd.
