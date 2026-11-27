# Edwin (AA Auto Body) scope-of-work call prep, 2026-11-27

Read-only prep. Sources: repo `main` at `1b0f5a29`, the live portal read through the read-only MCP tools, PRs #259 to #275, the proposal PDF and agreements in the shared project folder, and the other project threads. "Not confirmed" means the repo and read-only checks cannot show it. No phone numbers or emails are in this file on purpose.

**Where things stand today**
- AA tenant `aa-auto-body-shop`: status active, `go_live_at` empty, modules `crm`, `platform`, `shop_ops` only, no sign-in yet. Active was set by a direct database write on 11-25 so View as client works. It is not a real go-live.
- Portal runs `PROVIDER_MODE=stub`, `OUTBOUND_ENABLED=false`. No call, text or email goes to anyone, for any client.
- Shop pages and sample data (148 rows, tag `aa-shop-demo-v1`) were loaded live per the build-loop thread. Not re-verified here, because the custom-fields read returned 403 for my key.
- Which commit is live is **not confirmed**. Last known live commit is `02a14cea` (11-25), with a view-as fix deploy prompt issued after it. PRs #268 to #274 (client stages, pipeline, restyle) are merged to `main` and **not deployed**; they carry migrations 1098 and 1099. Deploys need Abdullah's yes, and he is holding the deploy until he likes the design.
- Edwin's real problems and numbers (5 to 10 calls a day, closes about 2 of 5 quotes, jobs $200 to $6K out-of-pocket and $1.2K to $22K insurance) come from the call notes in the proposal. "About 99% of insurance jobs in Audatex" and "cash estimates in QuickBooks" are **not confirmed** anywhere in the repo or shared files. Treat them as things Edwin said on a call and re-ask.

## 1. What we are building, mapped to his problems

Status key: **Built** = works in the portal today. **Partial** = screens or code exist but nothing real runs. **Not started**.

| # | System | What it does for him | What Edwin does | Status today | Problem it fixes |
|---|---|---|---|---|---|
| 1 | Never Miss a Lead: receptionist and missed-call text-back | Answers missed and after-hours calls in English and Spanish, books the estimate, asks for photos, texts back missed callers | Approves every ballpark price, picks who the shop line forwards to, answers a short list of shop questions | **Partial.** Portal has Leads, Calls and texts, a walk-in form, and Away mode (saves a setting only, pauses nothing). A test receptionist ("Maya") exists as an ElevenLabs demo with no phone number, texting or calendar. Missed-call text-back code exists for other clients but the module is off for AA and sending is off. No provider is set up for AA | Missed calls never returned (5 to 10+ a day) |
| 2 | Close More Jobs: quote follow-up | Follow-up at 1 hour, then 1, 3, 7 and 14 days, plus reactivation emails to old quotes | Tells us who said yes to texts. Reviews the wording | **Partial.** Quotes page with follow-ups tab is **Built** (reads the portal's own deals). The follow-up engine exists but the `quote_followup` module is off for AA and it cannot send. The template's "Quoted" stage enrollment is unverified live | No quote follow-up (closes about 2 of 5) |
| 3 | Shop Command Center: jobs board, calendar, weekly numbers | One place for leads, jobs, past customers, drop-off calendar, cars done and money in each week | Moves cards, or lets us enter jobs. Texts the appointment details today, which is the habit we replace | **Built** in the portal (15 pages, 8-stage job board, calendar, weekly report, Money in and out). **Partial** in practice: data is sample only, the calendar does not sync with his phone, reminders and "text customer on every move" are disabled buttons | Appointments only in his texts. No weekly numbers |
| 4 | Money view and QuickBooks | Weekly cash-in, average ticket, insurance vs out-of-pocket, close rate | Enters or confirms the estimate amount and payment type per job until QuickBooks is connected | **Partial.** Money and Report pages work off portal data. Estimate amount, payment type, insurer and claim number are portal fields he or we fill in. **QuickBooks connection: not started** (shows "Phase 2, needs your access"). Money out is an empty state with a disabled add | Out-of-pocket estimates living in QuickBooks |
| 5 | Insurance jobs and Audatex | Waiting-on-insurance list, supplement tracker, jobs tagged insurer and claim number | Today: types job details, or BCCs the estimate (see section 3) | **Partial.** Insurance page is a manual list and the supplement add is disabled. **Audatex connection: not started** | About 99% of insurance work sits in Audatex |
| 6 | Happy Customers and Reviews | Every customer gets the Google review link after every job. Reply drafts in his voice for him to approve | Approves replies, gives us the Google link | **Partial.** Reviews page, drafted replies, Approve (records approval only, posts nothing) are built. No Google connection. Ratings are typed in by Kynetic. Requests cannot send (flag off) | Reviews depend on someone remembering |
| 7 | Get Found: listings, SEO, AI search, English and Spanish site, QR code | Listings kept consistent, website with before/after slider, QR code for photo estimates | Approves site copy and photos, gives listing logins | **Partial.** Demo website exists on a separate branch (live demo link in the fact-check file). Get found page is a checklist and draft posts only. Listings, weekly SEO, AI search pages, real site go-live and QR are **not started** | Hard to find day or night |

Proposal items that are quoted separately later and are **not** in the $3,500: insurance claim follow-up, Audatex and QuickBooks connections, ads management.

## 2. Pricing check

- **The shared-folder proposal PDF (`edwin/proposal.pdf`, dated 11-25) shows the right pricing:** $1,750 to start, $1,750 at go-live, $3,500 setup, $1,200 per month starting at go-live. It has a [LEGAL NAME] and [KICKOFF DATE] blank and signature lines.
- **PR #275 matters only for the portal's own proposal generator.** On `main`, the portal still prints "Pricing to be confirmed" on proposals and PDFs it generates. #275 is open and unmerged. Do not hand Edwin a PDF generated from the portal until it is merged and deployed. Use `edwin/proposal.pdf`.
- **Two older files still carry old pricing and must not go out:** `edwin-proposal.pdf` in the folder root (Standard $4,000 + $1,200, Partner Rate $2,000 + $895, and a guarantee) and all three `edwin-agreement-*.docx` (same $4,000 and $2,000 figures, plus a "5-new-customer guarantee"). The proposal thread's own plan was to rewrite the agreement to $3,500 and attach the proposal as Exhibit A. Not done as far as the files show.
- Open from the proposal thread: it does not say whether phone, text and AI usage cost is included in the $1,200. Decide before Edwin asks. Counsel review of the Terms is still pending (KI-002).

## 3. Audatex intake plan: what exists today

**Short answer: none of the intake exists.** The BCC idea is a plan, not code.

- The portal has no inbound email address and no email parser. Inbound routes cover Twilio texts and calls, voice, website leads and Resend event hooks only.
- No PDF reading or text-extraction library in `crm/`. No code mentions EMS files.
- What does exist: the Connections page shows Audatex as "Phase 2, needs your access" (hardcoded text), the Insurance page (manual), and per-job fields for insurer, claim number, estimate amount and payment type.

| Step | Build needed | Status |
|---|---|---|
| Phase 1: Edwin BCCs a jobs@ portal address on estimate emails | Mailbox and DNS for the address, inbound mail route, tenant routing, PDF text extraction, field mapping (customer, vehicle, insurer, claim number, estimate total), a review screen. Parsed values should be suggestions that a person confirms, never auto-written to money figures | **Not started** |
| Phase 2: EMS folder export | Read the EMS files Audatex writes to a folder on his shop PC. Needs the folder location, which Audatex modules he has, and a small uploader or drive-sync on his computer | **Not started.** Depends on his answers in section 4 |
| Fallback until either exists | Enter insurance jobs by hand, one card per job | Works today |

Caution: say "we will build and test this with your real estimates," not "it works." Audatex PDF layouts vary and we have seen none yet. Not confirmed that Audatex lets us read its files at all.

## 4. Questions I must ask him

1. **How does insurance money come in?** Check to the shop, check to the customer, direct deposit? Who pays the deductible, and when?
2. **What does the customer pay at pickup?** Deductible only? Balance? Do out-of-pocket jobs get a deposit?
3. **QuickBooks Online or Desktop?** (We can only reach Online. Cost to him is about $120 a month per his earlier call, not confirmed.)
4. **Which Audatex modules do you have, and which computer runs them?** Does it write EMS files to a folder? (Also confirm the shop software: the notes guess "AutoLeap" for "Autotrader" and say to confirm.)
5. **Who answers the phone today?** Who should missed calls forward to? Who handles after-hours? Is Robert the person learning estimates and customer replies?
6. **Does his wife sign too?** She is part owner. Who is the signing party on the agreement, and what is the exact legal name?
7. **Texting (10DLC) registration details.** Exact legal business name, entity type, EIN, business address, website, a contact name and phone, and the shop's use case and sample messages. Plus: does he have written permission from customers to text, and can we have his opt-in wording? Texting to his customers cannot start until the carrier approves his registration. Approval time is **not confirmed**.
8. Does he want the shop line forwarded to the receptionist, or a new number? Who owns the Google Business Profile login?
9. Which weekdays and hours should the receptionist treat as closed? (Hours conflict in the notes: 8 to 6 on his own site, 9 to 6 on Birdeye. Saturday unclear.)

## 5. Go-live checklist and timeline

**Checklist (nothing here is done unless marked)**
1. Contract: rewrite to $3,500 + $1,200 with the proposal as Exhibit A, remove guarantee and Partner Rate, counsel review. *Not done.*
2. Edwin signs (and his wife if she is a signer), first $1,750 paid. Stripe is not wired, so the deposit is recorded by hand today.
3. Deploy `main` to live, with Abdullah's yes (migrations 1098 and 1099; pre-deploy dump; health check). *Waiting on design sign-off.*
4. Merge PR #275 if portal-generated proposals are used.
5. Replace sample data with Edwin's real jobs, leads and customers. Remove the `aa-shop-demo-v1` batch first.
6. Turn on AA modules that are off today (receptionist, missed-call text-back, quote follow-up). Real providers needed: a phone number, a paid voice plan, workflow credentials. Providers are stub/off for every client today.
7. 10DLC registration submitted and approved.
8. Review links set, Google review link and listing logins collected.
9. Website, listings, QR code, AI-search pages built and approved.
10. Test with his real past jobs for two weeks (proposal promise), then Abdullah's go-live step, then the second $1,750 and the monthly start.
11. Owner invite sent only when he is ready (staff sign-in is email code only).

**Realistic timeline (my estimate)**
- **Today (Fri 11-27):** call. Nothing is signed.
- **Week of 12-1:** contract fixed and sent after a yes. Deposit paid. Deploy decision.
- **Weeks 1 and 2 after kickoff (about 12-7 to 12-18):** portal, calendar, reviews, real data load. Provider and 10DLC setup start on day one because they have waiting time.
- **Weeks 3 and 4 (about 12-21 to 1-1):** testing with real jobs. Holiday weeks will slow his feedback.
- **Earliest go-live: the first week of January. Safer to say mid-January.** The four-week promise holds for the portal-side pieces only. Calls and texts depend on provider setup and carrier approval, which are not started and have no confirmed duration. Audatex and QuickBooks are outside this timeline.

## 6. Things in the repo or files that would be a problem on the call

| Where | What | Action |
|---|---|---|
| `edwin-agreement-STANDARD / PARTNER / 2page.docx` | "5-new-customer guarantee" (no monthly fee until 5 new customers), plus "Partner Rate" and $4,000 / $2,000 setup | Do not send. Rewrite first |
| `edwin-proposal.pdf` (folder root) | Same guarantee text, Partner Rate $2,000 + $895, Standard $4,000 | Do not show. Use `edwin/proposal.pdf` |
| Call script (`edwin/call-script.md`) | Script says "don't say founding, discount, guarantee". Also its objection step 3 promises "you see it work before the second payment," which implies a result check. Fine to say, just never as a guarantee | Keep wording to "we test on your real jobs" |
| `KYNETIC_CONTEXT.md`, `docs/STATUS.md`, `docs/PRD.md`, `site/src/niches/remodelers.ts` | The 20% booking guarantee ("20% more appointments in 30 days or we work free"). Written for remodelers | Never quote to Edwin. Not part of his offer |
| Client dashboard (`crm/src/app/dashboard/page.tsx`) | A "Booking guarantee" card shows for standard clients. Edwin is redirected to the shop Today page, so he should not see it. Not browser-tested | Click through his login before he does. Also the admin Billing page shows a "Founding" label and a stale $6,500 text for founding tenants. AA is plan "value", so not shown for him. Internal only |
| Onboarding form default plan "Founding" | Internal label. Visible only to staff | Don't screen-share admin pages |
| `docs/DECISIONS.md`, `PRD.md`, `DATABASE.md`, `TESTING.md` | Old "founding price" and $6,500 / $1,500 text, marked historical | Not for the call. Don't screen-share |
| Website `site/` | "Live and ready" and "Already built and tested" badges on the remodeler page. The 11-21 audit says that is not true today | Don't point Edwin to that page |
| Review gating | **Not found.** The shop Reviews page says every customer gets the Google link with no star filtering, with a test behind it. The remodeler site wording is also "no review gating." The agreements still use older wording that the handoff says needs a fix | Safe to say "every customer, no filtering." Check the contract wording |
| Made-up stats | The proposal PDF and portal demo carry no invented stats. The demo uses clearly fake data (labelled). The handoff flags earlier numbers with no source (55% / 80%) and one vendor figure (23.6% after-hours) | Do not use them. Source-verified only: 6% to 45% (BrightLocal) |
| Proposal facts | "5.0 stars, about 230 Google reviews, #3 in NW Dallas" | Count is 247 on the newest Google data (Oct 25) but 190 and 280 in other directories. "#3" is **not confirmed** in the fact-check file. Re-check before saying it |
| Content pack | Quotes his flyer's "100% satisfaction guaranteed." | That is his guarantee on his own flyer. Don't repeat it as ours |
| Wording | "cash" appears in older notes, the demo says "Out-of-pocket" | Use "out-of-pocket" |
| Demo portal | Fake data, English only, uses invented customer names | Say it is sample data, as the script does. Never imply past clients |

**Not confirmed from the repo:** the live commit, the custom-field and pipeline state on the live AA tenant, the proposal checklist state, whether Edwin has already agreed to anything since the 11-25 call, and how much of the 11-25 call he accepted.
