# PORTAL DEMO CLIENT 09: Clarity Windows And Doors — data profile

_Twenty note `fd48b202`, created 2026-11-10, updated 2026-11-10. Exported 2026-11-12._

> **Status:** PROPOSED spec, written Monday Nov 9, 2026. Every volume, rate, price and sample value below is **proposed example (mock) data, not real**. Nothing has been seeded into the portal. Seeding waits on Abdullah's decision: real vs synthetic demo leads. Sources: portal repo main 84332586 (PRs #143–#150 merged), read-only queries on the production portal DB (Nov 9, 2026, 6:40 PM PST), the Portal Blueprint page, and `portal-batches/PLAN.md`.

**Tenant:** `clarity-windows-doors` (id `50f77131-da29-4a13-9718-e9f0f528fa4b`), status onboarding, plan founding. **Niche:** Windows and doors. **Fit:** In the D-023 niche list (window and door replacement).

## Profile
| Field | Real today (public facts in the portal) | Proposed for the demo (mock, to confirm) |
|---|---|---|
| Business name | Clarity Windows And Doors | — |
| Niche / services | Window replacement, Door replacement | Service mix: Window replacement 75%, Door replacement 25% |
| Location | 800 Freeport Pkwy Suite 150, Coppell, TX | — |
| Service area | Coppell, TX (city only) | DFW; ZIP list to confirm with the owner |
| Phone (transfer number) | +1 972-393-3991 | Use as transfer number only after owner confirms |
| Website | None found | — |
| Public notes | Facebook rating 4.8 from 44 reviews | — |
| Active Meta ads (Nov 3) | 22 | — |
| Reviews | Yelp: 31 reviews, 4.5 | Monthly snapshot; mock values flagged |
| Time zone | America/Chicago | — |
| Business hours | Empty | Mon–Fri 8:00–18:00, Sat 9:00–13:00, Sun closed |
| Avg job value | Empty | $16,000 (range $8,000–$30,000 whole-home windows; $2,500–$9,000 entry/patio door) |
| Pricing tier / prices | Empty; module_prices holds the old menu | TBD — blocked on the prices decision (D-023 founding $6,500 is the dated approval) |
| Team | No users | Owner + 1 office staff, fictional `owner-clarity-windows-doors@example.test` / `staff-clarity-windows-doors@example.test` (real owner names not used) |
| Branding | Empty | Logo + brand color from public site only with permission; otherwise neutral |
| Recording disclosure | Empty | "This call may be recorded" wording — waits on counsel |

## Alex settings (proposed)
| Setting | Proposed value |
|---|---|
| Provider | fake (demo); real is ElevenLabs via n8n, live only with a yes |
| Status | Paused (stays paused for a demo) |
| Greeting | "Hi {first_name}, this is Alex, an AI assistant with Clarity Windows And Doors. I'm calling about the {service} request you just sent. This call may be recorded. Do you have a minute?" |
| Qualification questions | Is this for windows, doors, or both?; About how many windows or doors?; What is the property address?; Do you own the home?; When would you like this done?; Can we book a free in-home measure and quote? |
| Booking rules | In-home measure and quote, 60 min; earliest next business day; max 2 per time slot; inside business hours only |
| Call windows | Mon–Sat 9:00–20:00 local (inside 8 AM–9 PM quiet hours) |
| Retry | 3 attempts: immediately, +2 hours, next day 10:00; stop on reply/booked/DNC |
| Transfer number | +1 972-393-3991 |

## Systems and automations (proposed)
- **Systems on:** platform, alex_core, crm (full), quote_followup.
- **Automations on:** speed_to_lead, appointment_reminders, no_show_recovery, quote_followup. Missed-call text-back shown off (SMS waits on A2P).
- **One open system request** from the owner (e.g., reactivation or online presence) to fill `/admin/system-requests`.

## Pipeline stages
BLOCKED (no windows/doors stage content provided). Proposed: New lead → Consultation booked → Measure done → Quote sent → Contract signed → Install scheduled → Won / Lost.

## Guarantee
Baseline (last month booked appointments, admin override) = **20**; target = ceil(baseline × 1.2) = **24**; start = 30 days before seed date; window 30 days. Proposed mock bookings in window = 26 (on track).

## Proposed mock volumes
| Data (table) | Per 30 days | 90-day seed | Notes |
|---|---|---|---|
| Leads (`contacts`) | 88 | 264 | Meta ads 55% (`meta_ads`), website form 20% (`form`, counts toward speed-to-lead), Google ads 15% (`google_ads`), referral 10% (`referral`) |
| Deals (`deals`) | 88 | 264 | Value ≈ avg job ± 40%; 16 lost / 30 days |
| Call attempts (`calls`) | 167 | 501 | Outcome mix in spec 01; transcripts + summaries on reached calls |
| Contacts reached | 58 | 174 | distinct contacts with a non-voicemail/no-answer outbound call |
| Appointments (`appointments`) | 26 | 78 | 18 completed, 3 no-show, 1 cancelled, 4 upcoming; booked_by alex 80%, user 20% |
| Won deals / revenue | 5 | 15 | $80,000 per 30 days at the proposed avg job |
| Messages (`messages`) | 220 | 660 | confirmations, reminders, quote follow-ups |
| Tasks | 53 | 159 | call back, send quote, confirm appointment |
| Notes | 31 | 93 | site-visit notes |
| Activities (timeline) | 704 | 2112 | ~8 per lead |
| Automation runs | 123 | 369 | mix of completed, stopped_booked, stopped_reply, active |
| Consents | 88 | 264 | express_written on form leads; 1–2 opt-outs / DNC to show compliance |
| Support threads | 2–3 | 2–3 | one general, one alex_change |
| Reports | 1 | 3 | Aug/Sep/Oct monthly_roi |
| Notifications (owner) | 88 | 264 | new_lead, booked, hot_lead, report_ready |
| Customer companies | — | 4 | builders / property managers |

## Still needed from a real owner (only if this business signs)
- Real hours, ZIPs, transfer number, logo/color, avg job value, last month's booked appointments (guarantee baseline), lead sources and ad account access, calendar choice, and consent wording sign-off.

