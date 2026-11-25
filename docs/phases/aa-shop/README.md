# AA shop track: the shop screens for AA Auto Body (and any shop client after)

Goal: every screen from the AA demo exists as a real page in the Kynetic portal (`crm/`), frontend first, for the client `aa-auto-body-shop`. Pages read real data where the portal already has it. Where there is no backend yet, the page is fully built, shows an empty state, and any save or send action is visibly disabled. Sample data can be loaded, tagged and labeled, and removed in one command.

Source of the decisions: the 2026-11-24 call with Edwin, the big-picture plan (Claude doc "AA Auto Body portal: big-picture build plan"), and Abdullah's answers on 2026-11-25.

No timelines. Phases and steps only. Run it with `LOOP.md`.

## Decisions (Abdullah, 2026-11-25)

- The shop screens live inside the standard portal as one new module, `shop_ops` ("Shop operations"), switched on per client from Admin. Other clients keep today's sidebar and pages.
- The target client already exists: slug `aa-auto-body-shop`, plan value, modules `platform` and `crm`. Nothing is created by this track.
- Sample data is allowed in the client's account. It must carry a batch tag (`aa-shop-demo-v1`), show a visible "Demo data" label while present, and be removable with one command.
- Five sidebar groups for shop clients (Settings and Help sit inside the last one).
- Backend work comes later and is out of scope here. The only database change allowed in this track is the one `module_catalog` row for `shop_ops` (A-S1).

## The five groups and where each screen comes from

| Group | Screen | Built on | New or restyled |
|---|---|---|---|
| Front desk | Today | Dashboard | restyled, shop tiles added |
| Front desk | Leads | Leads, contacts, import | restyled, source chips, summary, photos area, Add walk-in |
| Front desk | Calls and texts | Calls plus Messages | restyled, adds receptionist rules view and "Where is my car?" preview |
| Front desk | Calendar | Appointments | restyled, drop-off/estimate/pickup types, reminder badges |
| Shop floor | Jobs board | Pipeline | restyled, car cards |
| Shop floor | Quotes (with Follow-ups tab) | Deals in the Quoted stage and quote follow-up runs | new view |
| Shop floor | Insurance | Deals in Waiting on insurance plus supplement records | new |
| Shop floor | Team | Deals by owner | new view |
| Money | Weekly report | Reports | restyled, cars and money |
| Money | Money in and out | Won deals (in), expenses (out, none yet) | new |
| Money | Documents | Documents | regrouped only |
| Customers and reputation | Customers | Contacts | restyled, totals, review status, Bring back preview |
| Customers and reputation | Reviews | Reviews | restyled, request to every customer, no filtering, drafted replies with Approve |
| Customers and reputation | Get found | Online presence | restyled |
| Customers and reputation | Referrals | Referrals | regrouped only |
| Control | Away mode | Notifications settings plus Alex pause | new |
| Control | Connections | none | new, status only |
| Control | Settings, Help | existing | regrouped only |

## Order

| Phase | File | What it ends with |
|---|---|---|
| A. Foundation | `phase-A.md` | `shop_ops` module, shop sidebar, data layer, UI kit, sample data seeder |
| B. Front desk | `phase-B.md` | Today, Leads, Calls and texts, Calendar |
| C. Shop floor | `phase-C.md` | Jobs board, Quotes with Follow-ups, Insurance, Team |
| D. Money | `phase-D.md` | Weekly report, Money in and out, Documents |
| E. Customers and reputation | `phase-E.md` | Customers, Reviews, Get found, Referrals |
| F. Control and finish | `phase-F.md` | Away mode, Connections, whole-product pass, final report |

Phase order holds: A before everything. B to E can follow in order; each starts when the previous one has merged.

## Nothing here approves

A deploy, applying a migration live, switching the module on for a client, loading sample data into a live account, a provider key, DNS, a real call, text or email. Those are collected in `LIVE-STEPS.md` and shown once at the very end.
