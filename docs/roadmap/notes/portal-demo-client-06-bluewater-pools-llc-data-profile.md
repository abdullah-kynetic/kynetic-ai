# PORTAL DEMO CLIENT 06: BlueWater Pools, LLC — data profile

_Twenty note `4dc6ae17`, created 2026-11-10, updated 2026-11-10. Exported 2026-11-12._

> **Status:** PROPOSED spec, written Monday Nov 9, 2026. Every volume, rate, price and sample value below is **proposed example (mock) data, not real**. Nothing has been seeded into the portal. Seeding waits on Abdullah's decision: real vs synthetic demo leads. Sources: portal repo main 84332586 (PRs #143–#150 merged), read-only queries on the production portal DB (Nov 9, 2026, 6:40 PM PST), the Portal Blueprint page, and `portal-batches/PLAN.md`.

**Tenant:** `bluewater-pools` (id `55f4c981-4b24-43cf-b4b6-76ed2b92392b`), status onboarding, plan founding. **Niche:** Custom pools. **Fit:** In the D-023 niche list (custom pool builders).

## Profile
| Field | Real today (public facts in the portal) | Proposed for the demo (mock, to confirm) |
|---|---|---|
| Business name | BlueWater Pools, LLC | — |
| Niche / services | Custom pool build, Pool remodel, Outdoor living | Service mix: Custom pool build 60%, Outdoor living 25%, Pool remodel 15% |
| Location | 10424 FM 1902, Crowley, TX | — |
| Service area | Crowley, TX (city only) | DFW (Fort Worth side); ZIP list to confirm with the owner |
| Phone (transfer number) | +1 817-297-7120 | Use as transfer number only after owner confirms |
| Website | bluewatercustompools.com | — |
| Public notes | Family-owned, 25+ years (own site) | — |
| Active Meta ads (Nov 3) | 8 | — |
| Reviews | None captured | Monthly snapshot; mock values flagged |
| Time zone | America/Chicago | — |
| Business hours | Empty | Mon–Fri 8:00–18:00, Sat 9:00–13:00, Sun closed |
| Avg job value | Empty | $82,000 (range $55,000–$140,000 new gunite build; $15,000–$45,000 remodel; $20,000–$60,000 outdoor living) |
| Pricing tier / prices | Empty; module_prices holds the old menu | TBD — blocked on the prices decision (D-023 founding $6,500 is the dated approval) |
| Team | No users | Owner + 1 office staff, fictional `owner-bluewater-pools@example.test` / `staff-bluewater-pools@example.test` (real owner names not used) |
| Branding | Empty | Logo + brand color from public site only with permission; otherwise neutral |
| Recording disclosure | Empty | "This call may be recorded" wording — waits on counsel |

## Alex settings (proposed)
| Setting | Proposed value |
|---|---|
| Provider | fake (demo); real is ElevenLabs via n8n, live only with a yes |
| Status | Paused (stays paused for a demo) |
| Greeting | "Hi {first_name}, this is Alex, an AI assistant with BlueWater Pools, LLC. I'm calling about the {service} request you just sent. This call may be recorded. Do you have a minute?" |
| Qualification questions | Are you looking for a new pool, a remodel, or outdoor living?; What is the property address?; Do you have an HOA?; What budget range are you planning for?; When would you like to swim?; Can we book a backyard design consult? |
| Booking rules | Backyard design consultation, 90 min; earliest next business day; max 2 per time slot; inside business hours only |
| Call windows | Mon–Sat 9:00–20:00 local (inside 8 AM–9 PM quiet hours) |
| Retry | 3 attempts: immediately, +2 hours, next day 10:00; stop on reply/booked/DNC |
| Transfer number | +1 817-297-7120 |

## Systems and automations (proposed)
- **Systems on:** platform, alex_core, crm (full), quote_followup.
- **Automations on:** speed_to_lead, appointment_reminders, no_show_recovery, quote_followup. Missed-call text-back shown off (SMS waits on A2P).
- **One open system request** from the owner (e.g., reactivation or online presence) to fill `/admin/system-requests`.

## Pipeline stages
BLOCKED (no pools stage content provided). Proposed: New lead → Design consult booked → 3D design sent → Proposal sent → Financing/contract → Dig scheduled → Won / Lost.

## Guarantee
Baseline (last month booked appointments, admin override) = **4**; target = ceil(baseline × 1.2) = **5**; start = 30 days before seed date; window 30 days. Proposed mock bookings in window = 6 (on track).

## Proposed mock volumes
| Data (table) | Per 30 days | 90-day seed | Notes |
|---|---|---|---|
| Leads (`contacts`) | 32 | 96 | Meta ads 55% (`meta_ads`), website form 20% (`form`, counts toward speed-to-lead), Google ads 15% (`google_ads`), referral 10% (`referral`) |
| Deals (`deals`) | 32 | 96 | Value ≈ avg job ± 40%; 6 lost / 30 days |
| Call attempts (`calls`) | 61 | 183 | Outcome mix in spec 01; transcripts + summaries on reached calls |
| Contacts reached | 21 | 63 | distinct contacts with a non-voicemail/no-answer outbound call |
| Appointments (`appointments`) | 6 | 18 | 4 completed, 1 no-show, 0 cancelled, 1 upcoming; booked_by alex 80%, user 20% |
| Won deals / revenue | 1 | 3 | $82,000 per 30 days at the proposed avg job |
| Messages (`messages`) | 80 | 240 | confirmations, reminders, quote follow-ups |
| Tasks | 19 | 57 | call back, send quote, confirm appointment |
| Notes | 11 | 33 | site-visit notes |
| Activities (timeline) | 256 | 768 | ~8 per lead |
| Automation runs | 45 | 135 | mix of completed, stopped_booked, stopped_reply, active |
| Consents | 32 | 96 | express_written on form leads; 1–2 opt-outs / DNC to show compliance |
| Support threads | 2–3 | 2–3 | one general, one alex_change |
| Reports | 1 | 3 | Aug/Sep/Oct monthly_roi |
| Notifications (owner) | 32 | 96 | new_lead, booked, hot_lead, report_ready |
| Customer companies | — | 2 | builders / property managers |

## Still needed from a real owner (only if this business signs)
- Real hours, ZIPs, transfer number, logo/color, avg job value, last month's booked appointments (guarantee baseline), lead sources and ad account access, calendar choice, and consent wording sign-off.

