# PORTAL DEMO CLIENT 05: Rodriguez Roofing — data profile

_Twenty note `3c795401`, created 2026-11-10, updated 2026-11-10. Exported 2026-11-12._

> **Status:** PROPOSED spec, written Monday Nov 9, 2026. Every volume, rate, price and sample value below is **proposed example (mock) data, not real**. Nothing has been seeded into the portal. Seeding waits on Abdullah's decision: real vs synthetic demo leads. Sources: portal repo main 84332586 (PRs #143–#150 merged), read-only queries on the production portal DB (Nov 9, 2026, 6:40 PM PST), the Portal Blueprint page, and `portal-batches/PLAN.md`.

**Tenant:** `rodriguez-roofing` (id `f519059b-7967-43a5-aed0-4a65cb3aa4ac`), status onboarding, plan founding. **Niche:** Roofing. **Fit:** Roofing was dropped as a target niche in D-023 (Oct 24). Keep as a demo, but these 5 are not first-three-client targets.

## Profile
| Field | Real today (public facts in the portal) | Proposed for the demo (mock, to confirm) |
|---|---|---|
| Business name | Rodriguez Roofing | — |
| Niche / services | Roof replacement, Roof repair, Storm damage, Inspection | Service mix: Roof replacement 50%, Storm damage 25%, Roof repair 20%, Inspection 5% |
| Location | Houston, TX | — |
| Service area | Houston, TX (city only) | Greater Houston; ZIP list to confirm with the owner |
| Phone (transfer number) | Not found | Leave blank until confirmed |
| Website | rodriguezroof.com | — |
| Public notes | Third-generation family firm serving Houston since 1963 (own ad copy) | — |
| Active Meta ads (Nov 3) | 3 | — |
| Reviews | None captured | Monthly snapshot; mock values flagged |
| Time zone | America/Chicago | — |
| Business hours | Empty | Mon–Fri 8:00–18:00, Sat 9:00–13:00, Sun closed |
| Avg job value | Empty | $14,500 (range $9,000–$22,000 replacement; $450–$1,500 repair) |
| Pricing tier / prices | Empty; module_prices holds the old menu | TBD — blocked on the prices decision (D-023 founding $6,500 is the dated approval) |
| Team | No users | Owner + 1 office staff, fictional `owner-rodriguez-roofing@example.test` / `staff-rodriguez-roofing@example.test` (real owner names not used) |
| Branding | Empty | Logo + brand color from public site only with permission; otherwise neutral |
| Recording disclosure | Empty | "This call may be recorded" wording — waits on counsel |

## Alex settings (proposed)
| Setting | Proposed value |
|---|---|
| Provider | fake (demo); real is ElevenLabs via n8n, live only with a yes |
| Status | Paused (stays paused for a demo) |
| Greeting | "Hi {first_name}, this is Alex, an AI assistant with Rodriguez Roofing. I'm calling about the {service} request you just sent. This call may be recorded. Do you have a minute?" |
| Qualification questions | What is the property address?; Is this for a repair, a full replacement, or storm/hail damage?; Roughly how old is the roof?; Are you working with your insurance company on a claim?; Are you the homeowner?; What day and time works for a free inspection? |
| Booking rules | Free roof inspection, 60 min, on-site; earliest next business day; max 2 per time slot; inside business hours only |
| Call windows | Mon–Sat 9:00–20:00 local (inside 8 AM–9 PM quiet hours) |
| Retry | 3 attempts: immediately, +2 hours, next day 10:00; stop on reply/booked/DNC |
| Transfer number | none until confirmed |

## Systems and automations (proposed)
- **Systems on:** platform, alex_core, crm (full), quote_followup, missed_call_textback (shown, but SMS blocked until A2P).
- **Automations on:** speed_to_lead, appointment_reminders, no_show_recovery, quote_followup. Missed-call text-back shown off (SMS waits on A2P).
- **One open system request** from the owner (e.g., reactivation or online presence) to fill `/admin/system-requests`.

## Pipeline stages
Current generic 8 stages (New → Contacted → Qualified → Estimate Booked → Estimate Done → Quoted → Won / Lost) — fine for roofing.

## Guarantee
Baseline (last month booked appointments, admin override) = **4**; target = ceil(baseline × 1.2) = **5**; start = 30 days before seed date; window 30 days. Proposed mock bookings in window = 6 (on track).

## Proposed mock volumes
| Data (table) | Per 30 days | 90-day seed | Notes |
|---|---|---|---|
| Leads (`contacts`) | 20 | 60 | Meta ads 55% (`meta_ads`), website form 20% (`form`, counts toward speed-to-lead), Google ads 15% (`google_ads`), referral 10% (`referral`) |
| Deals (`deals`) | 20 | 60 | Value ≈ avg job ± 40%; 4 lost / 30 days |
| Call attempts (`calls`) | 38 | 114 | Outcome mix in spec 01; transcripts + summaries on reached calls |
| Contacts reached | 13 | 39 | distinct contacts with a non-voicemail/no-answer outbound call |
| Appointments (`appointments`) | 6 | 18 | 4 completed, 1 no-show, 0 cancelled, 1 upcoming; booked_by alex 80%, user 20% |
| Won deals / revenue | 1 | 3 | $14,500 per 30 days at the proposed avg job |
| Messages (`messages`) | 50 | 150 | confirmations, reminders, quote follow-ups |
| Tasks | 12 | 36 | call back, send quote, confirm appointment |
| Notes | 7 | 21 | site-visit notes |
| Activities (timeline) | 160 | 480 | ~8 per lead |
| Automation runs | 28 | 84 | mix of completed, stopped_booked, stopped_reply, active |
| Consents | 20 | 60 | express_written on form leads; 1–2 opt-outs / DNC to show compliance |
| Support threads | 2–3 | 2–3 | one general, one alex_change |
| Reports | 1 | 3 | Aug/Sep/Oct monthly_roi |
| Notifications (owner) | 20 | 60 | new_lead, booked, hot_lead, report_ready |
| Customer companies | — | 2 | builders / property managers |

## Still needed from a real owner (only if this business signs)
- Real hours, ZIPs, transfer number, logo/color, avg job value, last month's booked appointments (guarantee baseline), lead sources and ad account access, calendar choice, and consent wording sign-off.

