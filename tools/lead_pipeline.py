#!/usr/bin/env python3
"""Lead pipeline: the steps around tools/lead_engine.py that turn its database into a dialing list in Twenty.

Standard library only. Reads the same SQLite file as lead_engine.py (leads.db). Every command that could
change Twenty or spend money is a dry run unless --apply.

  python tools/lead_pipeline.py audit                      # DIAL_READY rows must pass the gate or drop to HOLD
  python tools/lead_pipeline.py report                     # funnel counts, uncalled audited leads, days of dialing left
  python tools/lead_pipeline.py import                     # plan the Twenty load (GET only), writes nothing
  python tools/lead_pipeline.py import --apply             # create Companies + owner People in Twenty
  python tools/lead_pipeline.py sync                       # plan: mark leads called from Twenty leadStatus
  python tools/lead_pipeline.py sync --apply               # write the "called" flag to leads.db
  python tools/lead_pipeline.py refill                     # plan the next census batch if the list is running low
  python tools/lead_pipeline.py refill --apply             # run it: census, enrich, audit

Keys come from the environment or the repo-root .env: TWENTY_API_KEY, TWENTY_BASE_URL (default
https://crm.kyneticai.com), plus the lead_engine.py keys for refill. Never print values.
Twenty rules (CLAUDE.md): GET unless --apply, never DELETE, 100 requests per 60 s.
"""
import argparse
import csv
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import lead_engine as eng  # noqa: E402
import lead_enrich as le  # noqa: E402

DIALS_PER_DAY = 75  # Q4 plan (docs/progress.md)
TREG_PAGE_COST = 0.0011  # lead_engine.py docstring
ENTITY = re.compile(r"\b(llc|l\.l\.c|l\.?p|inc|corp|corporation|ltd|co|company|management|holdings|trust|group|"
                    r"enterprises|partners|services)\b\.?", re.I)
HONORIFIC = re.compile(r"^(mr|mrs|ms|miss|dr)\.?\s+", re.I)
# Order the refill works through: niche, then states with the most home-service ad spend first.
REFILL_NICHES = ["roofing", "bath", "kitchen", "windows", "siding", "foundation"]
REFILL_STATES = ["TX", "GA", "AZ", "TN", "NC", "SC", "CO", "MO", "KS", "IN", "AL", "NV", "UT", "OH", "MI"]


def digits(phone):
    d = re.sub(r"\D", "", phone or "")
    return d[1:] if len(d) == 11 and d[0] == "1" else d


def open_db(path):
    db = eng.db_open(path)
    for col in ("audit TEXT DEFAULT ''", "audit_reason TEXT DEFAULT ''", "twenty_id TEXT DEFAULT ''"):
        try:
            db.execute("ALTER TABLE leads ADD COLUMN " + col)
        except sqlite3.OperationalError:
            pass
    return db


def person_name(raw):
    """'Mr. Billy Ciccolella, MemberMr. Billy Ciccolella, Owner' -> 'Billy Ciccolella'. '' if it is an entity."""
    first = HONORIFIC.sub("", (raw or "").split(",")[0].strip())
    if not first or ENTITY.search(first) or len(first.split()) < 2 or not re.fullmatch(r"[A-Za-z.'\- ]+", first):
        return ""
    return first.title() if first.isupper() else first


# ---------- audit ----------
def audit_row(r, dnc):
    """Return a list of reasons this DIAL_READY row cannot be dialed yet (empty list = pass)."""
    row = json.loads(r["row_json"] or "{}")
    why = []
    if not r["state"] or r["state"] in eng.BLOCKED_STATES:
        why.append("state %r is blank or FL/OK" % r["state"])
    phone = digits(r["best_phone"])
    if len(phone) != 10:
        why.append("best phone is not a 10-digit number")
    else:
        srcs = [s for p, ss in (row.get("phones") or {}).items() if digits(p) == phone for s in ss]
        if not srcs:
            why.append("best phone has no source")
        if phone[:3] in le.BLOCKED_AREA_CODES:
            why.append("FL/OK area code")
        if phone in dnc:
            why.append("phone is on the do-not-call list file")
    owners = [o for o in row.get("owner_candidates", []) if o.get("source") and person_name(o.get("name"))]
    if not owners:
        why.append("no owner who is a named person with a source (entity or blank only)")
    sig = row.get("site_signals") or {}
    if sig.get("ai_answering") or sig.get("ai_claims"):
        why.append("already runs AI call answering")
    if sig.get("franchise_phrases"):
        why.append("franchise wording")
    if r["called"]:
        why.append("already called")
    return why


def audit(db, args):
    dnc = {digits(x) for x in Path(args.dnc_file).read_text().splitlines()} if args.dnc_file else set()
    db.row_factory = sqlite3.Row
    rows = db.execute("SELECT * FROM leads WHERE status='DIAL_READY' AND (audit='' OR audit IS NULL OR ?)",
                      (1 if args.recheck else 0,)).fetchall()
    passed = failed = 0
    out = []
    for r in rows:
        why = audit_row(r, dnc)
        verdict = "FAIL" if why else "PASS"
        if why:
            db.execute("UPDATE leads SET status='HOLD', audit=?, audit_reason=?, reason=? WHERE page_id=? AND niche=?",
                       (verdict, "; ".join(why), "audit: " + "; ".join(why), r["page_id"], r["niche"]))
            failed += 1
        else:
            db.execute("UPDATE leads SET audit='PASS', audit_reason='' WHERE page_id=? AND niche=?", (r["page_id"], r["niche"]))
            passed += 1
        out.append((r["name"], verdict, "; ".join(why)))
    db.commit()
    for name, v, why in out:
        print("  %-5s %-40s %s" % (v, name[:40], why))
    print("audit: %d pass, %d moved to HOLD" % (passed, failed))
    db.row_factory = None


# ---------- report ----------
def uncalled_pass(db):
    return db.execute("SELECT COUNT(*) FROM leads WHERE status='DIAL_READY' AND audit='PASS' AND called=''").fetchone()[0]


def report(db, args):
    for niche, status, audit_v, n in db.execute(
            "SELECT niche, status, COALESCE(NULLIF(audit,''),'-'), COUNT(*) FROM leads GROUP BY 1,2,3 ORDER BY 1,2,3"):
        print("  %-12s %-11s audit=%-4s %4d" % (niche, status, audit_v, n))
    n = uncalled_pass(db)
    print("audited, uncalled, dial-ready: %d = %.1f days at %d dials/day (the plan needs about 3,000 by task 7.1)"
          % (n, n / DIALS_PER_DAY, DIALS_PER_DAY))
    eng.stats(db)


# ---------- Twenty (REST) ----------
class Twenty:
    def __init__(self):
        eng.load_env()
        self.base = os.environ.get("TWENTY_BASE_URL", "https://crm.kyneticai.com").rstrip("/")
        self.key = os.environ.get("TWENTY_API_KEY")
        self.sent = []  # request times, for the 100 requests / 60 s limit

    def call(self, method, path, body=None):
        if not self.key:
            sys.exit("TWENTY_API_KEY not set (environment or .env)")
        if method == "DELETE":
            sys.exit("refusing to DELETE in Twenty (CLAUDE.md)")
        now = time.time()
        self.sent = [t for t in self.sent if now - t < 60]
        if len(self.sent) >= 90:
            time.sleep(max(0, 61 - (now - self.sent[0])))
        self.sent.append(time.time())
        req = urllib.request.Request(self.base + path, json.dumps(body).encode() if body is not None else None,
                                     {"Authorization": "Bearer " + self.key, "Content-Type": "application/json"}, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            sys.exit("Twenty %s %s -> HTTP %s %s" % (method, path, e.code, e.read()[:200].decode("utf-8", "replace")))

    def companies(self):
        """All companies, paged. Returns the raw record list."""
        out, cursor = [], None
        while True:
            q = "/rest/companies?limit=60" + ("&starting_after=" + cursor if cursor else "")
            data = self.call("GET", q)
            out += (data.get("data") or {}).get("companies", [])
            page = data.get("pageInfo") or {}
            cursor = page.get("endCursor")
            if not page.get("hasNextPage") or not cursor:
                return out


def company_body(r):
    c = {"name": r["name"], "leadSource": "SCRAPE", "metaAdsActive": True, "leadStatus": "NEW",
         "niche": eng.TWENTY_NICHE.get(r["niche"], "OTHER"), "ownerGate": "OWNER_UNVERIFIED",
         "metaPageId": r["meta_page_id"], "liveAds": r["live_ads"], "engineStatus": r["status"],
         "engineReason": r["reason"], "state": r["state"]}
    d = digits(r["best_phone"])
    if d:
        c["phone"] = {"primaryPhoneNumber": d, "primaryPhoneCountryCode": "US", "primaryPhoneCallingCode": "+1"}
    if r["website"]:
        c["domainName"] = {"primaryLinkUrl": r["website"]}
    if r["ad_library_link"]:
        c["adLibraryUrl"] = {"primaryLinkUrl": r["ad_library_link"]}
    if r["facebook_page"]:
        c["facebookPageUrl"] = {"primaryLinkUrl": r["facebook_page"]}
    if r["oldest_ad_days"] != "":
        c["oldestAdDays"] = r["oldest_ad_days"]
    c["newAds30d"] = r["new_ads_30d"]
    return c


def people_for(r):
    seen, out = set(), []
    for o in r["_owner_candidates"]:
        n = person_name(o.get("name"))
        if n and n.lower() not in seen and o.get("source"):
            seen.add(n.lower())
            first, _, last = n.partition(" ")
            out.append({"name": {"firstName": first, "lastName": last}, "contactRole": "OWNER",
                        "jobTitle": "Owner (sourced: %s)" % o["source"][:180]})
    return out[:2]


def import_leads(db, args):
    tw = Twenty()
    existing = tw.companies()
    have_pid = {c.get("metaPageId") for c in existing if c.get("metaPageId")}
    have_phone = {digits((c.get("phone") or {}).get("primaryPhoneNumber")) for c in existing}
    dnc_phone = {digits((c.get("phone") or {}).get("primaryPhoneNumber")) for c in existing
                 if c.get("leadStatus") == "DO_NOT_CALL"}
    args.status, args.niche, args.state, args.uncalled = "DIAL_READY", args.niche_filter, None, True
    rows = eng.lead_rows(db, args)
    ok = {r[0] for r in db.execute("SELECT page_id FROM leads WHERE audit='PASS'")}
    plan, skipped = [], []
    for r in rows:
        d = digits(r["best_phone"])
        if r["meta_page_id"] not in ok:
            skipped.append((r["name"], "not audited PASS (run audit)"))
        elif r["meta_page_id"] in have_pid:
            skipped.append((r["name"], "already in Twenty (Meta Page ID)"))
        elif d in dnc_phone:
            skipped.append((r["name"], "phone belongs to a DO_NOT_CALL company in Twenty"))
        elif d in have_phone:
            skipped.append((r["name"], "phone already on a Twenty company; check by hand"))
        else:
            plan.append(r)
    plan = plan[:args.limit]
    for r in plan:
        print("  create  %-40s %s  owner: %s" % (r["name"][:40], r["best_phone"],
                                                 ", ".join(p["name"]["firstName"] + " " + p["name"]["lastName"] for p in people_for(r)) or "-"))
    for n, why in skipped:
        print("  skip    %-40s %s" % (n[:40], why))
    print("%d to create, %d skipped, %d companies already in Twenty" % (len(plan), len(skipped), len(existing)))
    if not args.apply:
        print("dry run: nothing written to Twenty. Re-run with --apply after Abdullah's yes on this list.")
        return
    for r in plan:
        res = tw.call("POST", "/rest/companies", company_body(r))
        data = res.get("data") or {}
        cid = (data.get("createCompany") or data.get("company") or {}).get("id")
        if not cid:
            sys.exit("Twenty create returned no id for %s: %s" % (r["name"], json.dumps(res)[:200]))
        for p in people_for(r):
            tw.call("POST", "/rest/people", dict(p, companyId=cid))
        db.execute("UPDATE leads SET twenty_id=? WHERE page_id=? AND niche=?", (cid, r["meta_page_id"], r["niche"]))
        db.commit()
        print("  created", r["name"], cid)


# ---------- outcomes back from Twenty ----------
def sync(db, args):
    """A company that has moved off NEW in Twenty has been worked: mark it called so it never comes up twice."""
    tw = Twenty()
    n = 0
    for c in tw.companies():
        pid, status = c.get("metaPageId"), c.get("leadStatus")
        if not pid or status in (None, "NEW"):
            continue
        row = db.execute("SELECT name, called FROM leads WHERE page_id=?", (pid,)).fetchone()
        if row and not row[1]:
            print("  called  %-40s (Twenty status %s)" % (row[0][:40], status))
            if args.apply:
                db.execute("UPDATE leads SET called=? WHERE page_id=?", (time.strftime("%Y-%m-%d"), pid))
            n += 1
    db.commit()
    print("%d lead(s) %s" % (n, "marked called" if args.apply else "would be marked called (dry run, add --apply)"))


# ---------- refill ----------
def next_batch(db):
    """First (niche, state, cities) with city+phrase searches not yet stored."""
    for niche in REFILL_NICHES:
        for st in REFILL_STATES:
            cities = eng.cities_for(st)[:6]
            todo = [c for c in cities for ph in eng.NICHES[niche][0]
                    if not db.execute("SELECT 1 FROM searched WHERE niche=? AND phrase=? AND city=?", (niche, ph, c)).fetchone()]
            if todo:
                return niche, st, cities, len(todo)
    return None


def refill(db, args):
    n = uncalled_pass(db)
    days = n / DIALS_PER_DAY
    print("%d audited uncalled dial-ready leads = %.1f days (target %d days)" % (n, days, args.target_days))
    if days >= args.target_days:
        print("enough in stock, nothing to do")
        return
    nb = next_batch(db)
    if not nb:
        print("every niche/state in the rotation is already searched; widen REFILL_NICHES / REFILL_STATES")
        return
    niche, st, cities, searches = nb
    pages = searches * args.pages
    print("next batch: %s in %s (%s): %d searches, up to %d pages, about $%.3f of Treg (cap $%.2f)"
          % (niche, st, ", ".join(cities), searches, pages, pages * TREG_PAGE_COST, args.budget))
    print("then enrich up to %d businesses (about 5 Firecrawl credits each, cap %d), then audit"
          % (args.max_enrich, args.max_credits))
    if not args.apply:
        print("dry run: nothing spent. Re-run with --apply (spends Treg dollars and Firecrawl credits).")
        return
    ns = argparse.Namespace(cmd="run", db=args.db, niche=niche, state=st, metro=None, cities=",".join(cities), all_us=False,
                            per_state=6, source="treg", budget=args.budget, pages=args.pages, refresh=False, min_ads=2,
                            max_enrich=args.max_enrich, enricher="firecrawl", owner_contacts=False, enrich_budget=0,
                            max_credits=args.max_credits, apify_terms=10, apify_max=500, apify_cap=1.0, status=None,
                            uncalled=False)
    eng.run(ns)
    audit(db, argparse.Namespace(dnc_file=args.dnc_file, recheck=False))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["audit", "report", "import", "sync", "refill"])
    ap.add_argument("--db", default="leads.db")
    ap.add_argument("--apply", action="store_true", help="write to Twenty / spend money; default is a dry run")
    ap.add_argument("--dnc-file", help="text file of phone numbers to never dial (one per line)")
    ap.add_argument("--recheck", action="store_true", help="audit: re-run the gate on rows already audited")
    ap.add_argument("--niche-filter", help="import: only this niche")
    ap.add_argument("--limit", type=int, default=100, help="import: max companies per run")
    ap.add_argument("--target-days", type=int, default=3, help="refill: keep this many days of dials in stock")
    ap.add_argument("--budget", type=float, default=1.0, help="refill: Treg dollar cap for one batch")
    ap.add_argument("--pages", type=int, default=3)
    ap.add_argument("--max-enrich", type=int, default=60)
    ap.add_argument("--max-credits", type=int, default=400)
    args = ap.parse_args()
    db = open_db(args.db)
    {"audit": audit, "report": report, "import": import_leads, "sync": sync, "refill": refill}[args.cmd](db, args)


if __name__ == "__main__":
    main()
