# Pricing research (2026-10-18)

Third-party blogs and search results quoting vendor pages; the vendors' own pricing pages were blocked from the cloud session. Real billing from test calls is the number to trust (scorecard item 12). Retell's 14.5 cents a minute is our own measured figure (first live test).

| | Official / published per-minute rate | What else you pay | Rough all-in |
|---|---|---|---|
| ElevenLabs | $0.08 on every plan (elevenlabs.io/pricing/agents) | LLM billed separately (a small model adds about 1 cent); a Twilio line about 1.5 cents | about 9 to 11 cents |
| Retell | $0.07 to $0.31 (retellai.com/pricing); own example $0.11 = LLM $0.04 + voice infra $0.055 + TTS $0.015 | An ElevenLabs voice adds more; telephony about $0.015 | about 11 to 15 cents (14.5 measured) |
| Bland (dropped) | $0.14 free, $0.12 at $299/mo, $0.11 at $499/mo (docs.bland.ai/platform/billing) | Telephony separate; $0.015 minimum per outbound attempt | about 12 to 16 cents |

Conclusion: ElevenLabs is cheapest on list price by roughly 1 to 4 cents a minute; the margin is thin and the decision rule allows a challenger to lose up to 25 percent on cost or delay, so conversation quality decides.

Notes: Retell charges extra for an ElevenLabs voice, ElevenLabs bundles its own voice. ElevenLabs bills calls above the plan's concurrency limit at double. Earlier call billed 732 credits for 106 s on the Free tier (not convertible to dollars without the plan's credit price). Free tier = 15 minutes of calls; Creator is about $11 the first month (275 minutes, 10 concurrent calls). Upgrading is Abdullah's decision.
