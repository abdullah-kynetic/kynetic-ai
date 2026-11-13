# REF: SOURCE LIBRARY (index + analysis) — start here to find original transcripts

_Twenty note `ddb16181`, created 2026-10-01, updated 2026-10-14. Exported 2026-11-12._

Created Oct 1, 2026. **Rule: raw transcripts are saved word for word in their own note titled "SOURCE TRANSCRIPT NN — ...". Analysis lives here, never in the raw note.** Any session that needs to check where a claim came from should read this index first, then open the raw source.

## How to add a new transcript
1. Paste it to Claude and say "save as source transcript".
2. Claude creates a note: title `SOURCE TRANSCRIPT NN — speaker/topic (pasted date)`, body = header (who pasted it, speaker, URL if known, date) + the exact text.
3. Claude adds one line to the table below and a short analysis section.

## A. Saved in Twenty (word for word) — video transcripts
| # | Note | Topic | Used for |
|---|---|---|---|
| 01 | SOURCE TRANSCRIPT 01 — Synthesis founder (Oct 1, 2026) | Fastest ways to get a first AI voice client: cold call, cold email, paid ads, organic | Confirms cold calling as the main channel; sniper/passive check; opener advice |
| 02 | SOURCE TRANSCRIPT 02 — Retell AI outbound masterclass (pasted Oct 5, 2026) | Retell batch calling A-Z, dynamic variables, anti-spam/blocking settings (verified number, branded call, CPS vs concurrency math), triggering calls via API using Claude Code + Modal + Google Sheets instead of n8n | CPS/concurrency math and spam protection are new info not in our build yet |
| 03 | SOURCE TRANSCRIPT 03 — n8n + Vapi lead qualification (pasted Oct 5, 2026) | Form trigger, phone-normalize code node, Vapi create-call + polling loop, structured outputs to Google Sheets | Polling loop logic, phone validation before dialing, structured-output extraction |
| 04 | SOURCE TRANSCRIPT 04 — Sophia (Salesforce architect) (pasted Oct 5, 2026) | n8n + Retell + Salesforce: lead score via ChatGPT gates whether to call at all | Qualification gate BEFORE the call, not just during it |
| 05 | SOURCE TRANSCRIPT 05 — Krish: Retell multiprompt speed-to-lead (pasted Oct 5, 2026) | Retell multiprompt/states agent, Twilio Lookup phone verification, check_availability/book_slot custom functions, 3-stage webhook dedup | Closest architecture match to Emily's current build; states-vs-single-prompt directly relevant |
| 06 | SOURCE TRANSCRIPT 06 — Sareeb/Next Voice AI (pasted Oct 5, 2026) | Retell + n8n, Claude-written prompt, schedule trigger every 5 min, sheet filter on "not called" | Schedule-trigger + sheet-filter pattern; using Claude to draft the agent prompt |
| 07 | SOURCE TRANSCRIPT 07 — Point Flows (Nova) (pasted Oct 5, 2026) | n8n form → HTTP POST create-phone-call, separate webhook + summarization chain for AI call summary | Clean HTTP request walkthrough; separate post-call summarization webhook pattern |
| 08 | SOURCE TRANSCRIPT 08 — Retell + make.com tech support demo (pasted Oct 5, 2026) | Explicit TCPA compliance warning up front, voicemail detection, webhook dedup via event-type filter | Compliance note ties to KI-002/D-007; voicemail detection and dedup are must-haves |
| 09 | SOURCE TRANSCRIPT 09 — Adam/Sixflow Automations (pasted Oct 5, 2026) | Simplest possible Retell + n8n outbound HTTP request structure | Minimal sanity-check reference |

## A2. Saved in Twenty (word for word) — build templates (JSON workflows + prompting doc), uploaded Oct 5, 2026 for the Emily/outbound rebuild
| # | Note | Topic | Used for |
|---|---|---|---|
| T01 | SOURCE TEMPLATE 01 — Ultimate Multi Agent Template | n8n: ONE consolidated webhook + router agent (reads `action` param) for all calendar ops, hands off to a nested "post call agent" sub-agent for email+SMS+sheet | The consolidated-router architecture option, vs Emily's current per-tool-webhook pattern |
| T02+03 | SOURCE TEMPLATE 02+03 — standalone check_availability + book_appointment | Non-consolidated single-purpose n8n workflows, same pattern as Emily today | Confirms per-tool-webhook is also a standard, valid pattern |
| T04 | SOURCE TEMPLATE 04 — post-call one-word classifier | Transcript in, "Booked"/"unsuccessful" out, sheet updated by phone match | Cleanest version of "classify, then write only the classification" |
| T05 | SOURCE TEMPLATE 05 — Facebook Ad Form speed-to-lead (Vapi) + SolarShift voice prompt | **Closest match to task 3.5**: form → pre-call qualify/disqualify gate → normalize phone → call immediately → poll → post-call proceed/stop classifier → sheet update. Full matching voice prompt included | The template for the outbound rebuild, pattern-wise (swap Sheets→Twenty, Google Calendar→Cal.com) |
| T06 | SOURCE TEMPLATE 06 — CLAUDE.md Voice Agent Prompting Rules | Retell-specific house style: prompt structure template, SOP snippets (email/phone/address collection, confirmation pattern, speech normalization, hold-on handler), full worked example prompt, default Retell settings block, testing methodology | **Adopt almost wholesale** as retell/PROMPTING_STYLE.md — confirmed consistent with Retell's own API docs |

## B. Already stored in Google Drive (owner: abdullah@kyneticai.com). Found by search on Oct 1, 2026; only the opening of each was read, not the full text.
**Voice agency and AI receptionist selling:**
- [Ai Voice Agency pt.1](https://docs.google.com/document/d/1S3ZuRM91lllFU17FyQ5VvD6Yjbb-VzHCzutO8vyYgJs/edit) — interview, UK founder, £399/mo receptionists, says about 100 clients/month from ads (Oct 2025)
- [Ai Voice Agency pt.2](https://docs.google.com/document/d/1k0RqyT0XoqpRel510poH4Gk7FtsWycntgSQqqaVu5wI/edit) — salon receptionist build, Vapi + n8n + Google Calendar (Oct 2025)
- [AI Receptionists](https://docs.google.com/document/d/1e9F4_0K_Kbg65rADhh8VQX9tr6UBtrvN1t9KeIrhYq4/edit) — how to sell AI receptionists to local businesses, $300-500/mo, found via Google (Jan 2026)
- [HAROON KHAN BREAKDOWN](https://docs.google.com/document/d/1YL_ydZcrsFerRyWNn9laG4Wfg4AfFbiAWDBQJfyWbcU/edit) — two friends scale an AI receptionist agency to $12,735 (Dec 2025)
- [Transcript of How To Build An AI Receptionist For A Trades Business](https://docs.google.com/document/d/1w31h5KgfzqDfkKMuQUFlPDWEqVJKPCD8NZI_CQG8XFI/edit) — Inflate AI trades receptionist, the reference build (Jan 2026)
- [YT HVAC Vapi Transcript](https://docs.google.com/document/d/14EIJgbbMq1aeo8c_BrefK0fza4V2N84G2DItjMMIOcs/edit) — HVAC voice agent, missed-call math (Jan 2026)
- [Ai Receptionist Vapi](https://docs.google.com/document/d/17-gBQs8wFLt8mzEKrck0mCSaYR4dhu2zBLV3J2pWZLE/edit) — dental clinic speedrun, $500/mo (Dec 2025)
- [Retell AI PROMPTING](https://docs.google.com/document/d/1JJ1bjyVv6jFd7WULUkIVlIzYuQNb6Nz-WWDKPKZ9r0I/edit) — Retell zero to voice agent (Dec 2025)
- [best ai voice platform?](https://docs.google.com/document/d/15PMO05H2O3pc78o-678x6bB1MqhjFSgr2uQ8bSFoJJY/edit) — seven voice platforms compared (May 2026)
- [VAPI N8N Template Receptionists](https://docs.google.com/document/d/1URGTA4_6pVphDDsu9hJDznlEZ0OCsHggke6ANmpe5FI/edit) and [AI Receptionist build with (VAPI + n8n)](https://docs.google.com/document/d/1ukdzvgj7PwnHb0abGWhCrZxJq3lgRViUs2LZoHsz1K4/edit) (Nov 2025)

**Lead sourcing and outreach:**
- [Untitled document (Smartlead cold email campaign, Apollo lead list)](https://docs.google.com/document/d/1ODe7EoQOwpFHqGzeOBOzIBBWWyfT5mzN3nrQxbTsrWo/edit) (Apr 2025)
- [30-Minute AI Automations Anyone Can Set Up & Sell Right Now](https://docs.google.com/document/d/1N2qJbD3SfiCJjipy6VTHwF11Lntk9f5tCPikTZdBCCU/edit) — Google Maps scraper to sheet (May 2025)
- [Cold Outreach CRM (sheet)](https://docs.google.com/spreadsheets/d/19q8SIQVSac5xRHkOnF_QpSQff1U8VAw9PZKIMwCPs3o/edit) — Jan 2026 Dallas trades list, earlier pricing tier Setup $2,500 / MRR $900

**Agentic workflows (build method):** [AI Agentic Workflows](https://docs.google.com/document/d/1qKyBdQ5tJC7JvnG8fVXZrU4hT3Lq_anug4OMKL4ADLo/edit), [pt.2](https://docs.google.com/document/d/1WbLNygNRS6Gh1FhNoUFrpsq8NpXDNYELGBlRD6JUUu4/edit)

Other Drive transcripts (SaaS and app ideas, TradingView, Upwork posts, ZipCard) belong to other ventures and are not listed.

## C. Not recoverable (be honest about these)
- **The Meta Ads Library plan source.** The only copy is the summary note "Meta Ads Outreach Plan (Launch Mon Sep 28)". A Drive search for ad library / ownerphones / Apollo found nothing from Sep 2026. It was probably pasted into a chat and not saved.
- **Cold SMS videos reviewed Sep 24 to 25.** Only the summary survives, in "Outreach Research (Sep 24 to 25)".
- **The July 2026 AI OS transcripts.** The Notion page AI OS Reference says "The transcripts themselves are gone. This is what survived." This is the same failure this library exists to prevent.

## D. Analysis of SOURCE TRANSCRIPT 01
The speaker sells a course (comment "AI" for his playbook), so every number is his claim, not verified.

| What he says | Fits our plan how | Action |
|---|---|---|
| Cold calling is the fastest way to a first client because you get instant feedback. | Same as the plan's step 6. | Keep. Log every call outcome in Twenty. |
| "Passive cold call / sniper": look at the company's site, landing page and funnel, enter their info, see if there is a real need. | Same idea as the plan's "before each call, check where the ad goes". | Optional extension (Abdullah decides): actually submit the advertiser's form from a number you control and time the callback. |
| Do not open with "would you hate me if this is a cold call?" Use a pattern interrupt and sound like a buyer. | The plan's opener ("I just saw your ad, how fast are you responding to these people?") already does this. | Use the plan's opener. Be honest about who is calling. |
| Cold email needs about 100,000 emails per client and $1,000-2,000/mo of infrastructure. | Confirms the plan has no cold email. | Skip. |
| Paid ads for agencies now cost about $1,500-2,000 per client, up 3-4x. | Confirms no paid ads for Kynetic. | Skip paid ads. |
| Organic content is the hardest and longest. | Not in the plan. | Skip for now. |

## E. Analysis of SOURCE TRANSCRIPTS 02-09 and TEMPLATES T01-T06 (outbound rebuild research, Oct 5, 2026)
**Full synthesis moved to the dedicated note "ACTIVE BUILD PLAN: Emily Rebuild + Speed-to-Lead Outbound (Oct 5, 2026)" — read that note first for the actual plan.** This section keeps only the raw cross-source observations:
- TCPA/compliance: T05's analyzer and SOURCE TRANSCRIPT 08 both independently treat consent/disqualification as a hard gate.
- Architecture choice (states vs single prompt): SOURCE TRANSCRIPT 05 is the only video source using Retell's multiprompt/states agent; T01 is the only template source that consolidates all tool-calls into one router instead of per-tool webhooks (T02/T03 confirm per-tool is also standard, matching Emily today).
- Phone validation before dialing: SOURCE TRANSCRIPT 03 (code node) and 05 (Twilio Lookup) and T05 (code node) all validate/normalize before calling.
- Voicemail detection: explicit in SOURCE TRANSCRIPT 02 and 08. Not yet confirmed in Emily's config.
- Webhook dedup (3-stage firing): SOURCE TRANSCRIPT 05 and 08 both solve the same Retell problem (call_started/call_analyzed/end_of_call_report) independently — confirmed pattern, not a one-off.
- Pre-call qualification gate: T05 and SOURCE TRANSCRIPT 04 both gate BEFORE calling (disqualify and never dial), same idea as our own owner gate (D-002) applied at call time instead of just at lead-list time.
- Post-call classify-then-write: T04 (one word) and T05 (proceed/stop) and SOURCE TRANSCRIPT 03/05/08 (structured outputs / post-call analysis) all converge on "one clean classification output drives the next branch" as the standard pattern.
- Prompting house style: T06 is uniquely Retell-specific and matches our platform's confirmed API behavior exactly — recommended as the house style for all future prompts.
