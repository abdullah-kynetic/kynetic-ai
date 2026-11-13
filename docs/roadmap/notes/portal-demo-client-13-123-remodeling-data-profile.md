# PORTAL DEMO CLIENT 13: 123 Remodeling — data profile

_Twenty note `55367772`, created 2026-11-10, updated 2026-11-10. Exported 2026-11-12._

> **Status:** PROPOSED spec, written Monday Nov 9, 2026. Every volume, rate, price and sample value below is **proposed example (mock) data, not real**. Nothing has been seeded into the portal. Seeding waits on Abdullah's decision: real vs synthetic demo leads. Sources: portal repo main 84332586 (PRs #143–#150 merged), read-only queries on the production portal DB (Nov 9, 2026, 6:40 PM PST), the Portal Blueprint page, and `portal-batches/PLAN.md`.

**Tenant:** `123-remodeling` (id `15e5f8dd-894e-4cac-b7d1-ff93905e837f`), status onboarding, plan founding. **Niche:** Remodeling (kitchen and bath). **Fit:** First sales focus (D-023 reconciliation, Nov 8). The 20% guarantee is written for remodelers.

## Profile
| Field | Real today (public facts in the portal) | Proposed for the demo (mock, to confirm) |
|---|---|---|
| Business name | 123 Remodeling | — |
| Niche / services | Kitchen remodel, Bath remodel, Cabinetry | Service mix: Kitchen remodel 45%, Bath remodel 40%, Cabinetry 15% |
| Location | 12100 Ford Rd B148, Farmers Branch, TX (a second McKinney address also appears; confirm) | — |
| Service area | Farmers Branch, TX (city only) | DFW; ZIP list to confirm with the owner |
| Phone (transfer number) | +1 469-949-5775 | Use as transfer number only after owner confirms |
| Website | None found | — |
| Public notes | Address from Yelp; confirm before pitching | — |
| Active Meta ads (Nov 3) | 12 | — |
| Reviews | Yelp: 3 reviews, 5.0 | Monthly snapshot; mock values flagged |
| Time zone | America/Chicago | — |
| Business hours | Empty | Mon–Fri 8:00–18:00, Sat 9:00–13:00, Sun closed |
| Avg job value | Empty | $38,000 (range $18,000–$30,000 bath; $35,000–$85,000 kitchen; $8,000–$20,000 cabinetry) |
| Pricing tier / prices | Empty; module_prices holds the old menu | TBD — blocked on the prices decision (D-023 founding $6,500 is the dated approval) |
| Team | No users | Owner + 1 office staff, fictional `owner-123-remodeling@example.test` / `staff-123-remodeling@example.test` (real owner names not used) |
| Branding | Empty | Logo + brand color from public site only with permission; otherwise neutral |
| Recording disclosure | Empty | "This call may be recorded" wording — waits on counsel |

## Alex settings (proposed)
| Setting | Proposed value |
|---|---|
| Provider | fake (demo); real is ElevenLabs via n8n, live only with a yes |
| Status | Paused (stays paused for a demo) |
| Greeting | "Hi {first_name}, this is Alex, an AI assistant with 123 Remodeling. I'm calling about the {service} request you just sent. This call may be recorded. Do you have a minute?" |
| Qualification questions | Which room are you remodeling: kitchen, bath, or both?; What is the property address?; Do you own the home?; What budget range are you planning for?; When would you like the project to start?; Can we book an in-home design consultation? |
| Booking rules | In-home design consultation, 90 min; earliest next business day; max 2 per time slot; inside business hours only |
| Call windows | Mon–Sat 9:00–20:00 local (inside 8 AM–9 PM quiet hours) |
| Retry | 3 attempts: immediately, +2 hours, next day 10:00; stop on reply/booked/DNC |
| Transfer number | +1 469-949-5775 |

## Systems and automations (proposed)
- **Systems on:** platform, alex_core, crm (full), quote_followup, reactivation (one-time, old leads).
- **Automations on:** speed_to_lead, appointment_reminders, no_show_recovery, quote_followup, reactivation. Missed-call text-back shown off (SMS waits on A2P).
- **One open system request** from the owner (e.g., reactivation or online presence) to fill `/admin/system-requests`.

## Pipeline stages
Apply the remodeling template from PR #147: New lead → Consultation booked → Design in progress → Proposal sent → Contract signed → Build scheduled → Won / Lost (tenant still has the generic 8 stages today).

## Guarantee
Baseline (last month booked appointments, admin override) = **9**; target = ceil(baseline × 1.2) = **11**; start = 30 days before seed date; window 30 days. Proposed mock bookings in window = 12 (on track).

## Proposed mock volumes
| Data (table) | Per 30 days | 90-day seed | Notes |
|---|---|---|---|
| Leads (`contacts`) | 48 | 144 | Meta ads 55% (`meta_ads`), website form 20% (`form`, counts toward speed-to-lead), Google ads 15% (`google_ads`), referral 10% (`referral`) |
| Deals (`deals`) | 48 | 144 | Value ≈ avg job ± 40%; 9 lost / 30 days |
| Call attempts (`calls`) | 91 | 273 | Outcome mix in spec 01; transcripts + summaries on reached calls |
| Contacts reached | 32 | 96 | distinct contacts with a non-voicemail/no-answer outbound call |
| Appointments (`appointments`) | 12 | 36 | 8 completed, 1 no-show, 1 cancelled, 2 upcoming; booked_by alex 80%, user 20% |
| Won deals / revenue | 2 | 6 | $76,000 per 30 days at the proposed avg job |
| Messages (`messages`) | 120 | 360 | confirmations, reminders, quote follow-ups |
| Tasks | 29 | 87 | call back, send quote, confirm appointment |
| Notes | 17 | 51 | site-visit notes |
| Activities (timeline) | 384 | 1152 | ~8 per lead |
| Automation runs | 67 | 201 | mix of completed, stopped_booked, stopped_reply, active |
| Consents | 48 | 144 | express_written on form leads; 1–2 opt-outs / DNC to show compliance |
| Support threads | 2–3 | 2–3 | one general, one alex_change |
| Reports | 1 | 3 | Aug/Sep/Oct monthly_roi |
| Notifications (owner) | 48 | 144 | new_lead, booked, hot_lead, report_ready |
| Customer companies | — | 2 | builders / property managers |

## Still needed from a real owner (only if this business signs)
- Real hours, ZIPs, transfer number, logo/color, avg job value, last month's booked appointments (guarantee baseline), lead sources and ad account access, calendar choice, and consent wording sign-off.

