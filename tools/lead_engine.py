#!/usr/bin/env python3
"""Lead engine: build a stored database of independent home-service businesses running Meta ads.

One entry point, standard library only (plus tools/lead_enrich.py, which it imports for the
BBB / registry / website enrichment). Keys come from the environment or .env:
  TREG_API_KEY_KYNETICAI   ad census (Treg route anyapi.facebook.ads_search, about $0.0011 per page of ~30 ads)
  FIRECRAWL_API_KEY        enrichment (about 5 credits per business)
  APIFY_API_TOKEN          optional second census source (--source apify|both)

  python tools/lead_engine.py run --niche roofing --state TX --metro DFW      # census + enrich
  python tools/lead_engine.py run --niche bath --all-us --budget 5            # every state except FL/OK
  python tools/lead_engine.py census --niche roofing --cities "Phoenix,Tempe" --state AZ
  python tools/lead_engine.py enrich --niche roofing --max-credits 200
  python tools/lead_engine.py export --status DIAL_READY --uncalled out.csv
  python tools/lead_engine.py twenty-payload twenty_import.json              # dry-run Twenty records, nothing sent
  python tools/lead_engine.py mark "Bert Roofing Inc" called                  # so it never comes up twice
  python tools/lead_engine.py stats

Everything lands in one SQLite file (leads.db by default, --db to change), so reruns skip what is
already stored and you can top up in the background. Public sources only; it never logs in, submits
a form or contacts a business. Anything it cannot source stays "unknown". FL and OK are never searched.
The same code runs on Modal (see the bottom of the file; deploy is untested until you approve it).
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
TREG = "https://treg.to/call/anyapi.facebook.ads_search"
SPEND = {"treg": 0.0, "apify": 0.0}

# niche -> search phrases, and a regex the advertiser name/page category must match to be kept.
# Ticket sizes are rough (Angi / industry averages, not verified here).
NICHES = {
    "roofing": (["roofing", "roof replacement"], r"roof|exterior|shingle"),
    "bath": (["bathroom remodel", "walk-in shower"], r"bath|remodel|shower|renovat"),
    "kitchen": (["kitchen remodel"], r"kitchen|remodel|renovat|cabinet"),
    "foundation": (["foundation repair"], r"foundation|pier|slab|structur|waterproof|crawl"),
    "windows": (["window replacement"], r"window|door|glass"),
    "siding": (["siding replacement", "siding installation"], r"siding|exterior|roof"),
    "restoration": (["water damage restoration", "fire damage restoration", "mold remediation"],
                    r"restor|remediat|water|fire|mold|disaster|damage"),
    "fence": (["fence installation"], r"fenc"),
    "concrete": (["driveway concrete", "concrete patio"], r"concrete|paving|driveway|masonry"),
    "hvac": (["hvac replacement", "ac replacement"], r"hvac|air|heating|cooling|\bac\b|comfort"),
    "generators": (["standby generator"], r"generat|power"),
    "pools": (["pool installation", "pool remodel"], r"pool|spa|outdoor"),
}
BRANDS = ["mighty dog roofing", "roof maxx", "mr. roof", "leaffilter", "leafguard", "power home remodeling",
          "renewal by andersen", "window nation", "bath fitter", "re-bath", "west shore home", "bath planet",
          "five star bath", "kitchen tune-up", "servpro", "servicemaster", "paul davis", "belfor", "service master",
          "polygon", "puroclean", "homeadvisor", "angi", "modernize", "home service pros", "roofing contractors",
          "you may have a case", "attorney", "law firm", "seo", "webmaster", "marketing", "lead gen", "advertis",
          "roofing contractors"]
SOCIAL = {"", "fb.me", "fb.com", "facebook.com", "l.facebook.com", "instagram.com", "m.me", "wa.me", "linktr.ee",
          "forms.gle", "calendly.com", "bit.ly"}
PHONE_RE = re.compile(r"\(?\b([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-](\d{4})\b")
BLOCKED_STATES = {"FL", "OK"}  # never prospected

# state -> cities searched with --all-us or --state (largest home-service markets; edit freely)
CITY_TABLE = """TX:Dallas,Fort Worth,Arlington,Plano,Frisco,McKinney,Denton,Garland,Irving,Houston,Katy,The Woodlands,Sugar Land,San Antonio,Austin,Round Rock,El Paso,Corpus Christi,Lubbock,Amarillo,Waco,Tyler,Killeen,McAllen,Beaumont
GA:Atlanta,Marietta,Alpharetta,Savannah,Augusta,Columbus
AZ:Phoenix,Tucson,Mesa,Scottsdale,Chandler,Gilbert
TN:Nashville,Memphis,Knoxville,Chattanooga,Franklin
NC:Charlotte,Raleigh,Durham,Greensboro,Wilmington
SC:Greenville,Charleston,Columbia,Myrtle Beach
MO:Kansas City,St. Louis,Springfield
KS:Wichita,Overland Park,Topeka
IN:Indianapolis,Fort Wayne,Evansville
CO:Denver,Colorado Springs,Aurora,Fort Collins
AL:Birmingham,Huntsville,Mobile,Montgomery
CA:Los Angeles,San Diego,Sacramento,San Jose,Fresno,Riverside,Bakersfield
NV:Las Vegas,Henderson,Reno
UT:Salt Lake City,Provo,Ogden
OH:Columbus,Cleveland,Cincinnati,Toledo,Akron
MI:Detroit,Grand Rapids,Lansing
IL:Chicago,Naperville,Rockford,Springfield
WI:Milwaukee,Madison,Green Bay
MN:Minneapolis,Saint Paul,Rochester
IA:Des Moines,Cedar Rapids
NE:Omaha,Lincoln
AR:Little Rock,Fayetteville,Fort Smith
LA:New Orleans,Baton Rouge,Shreveport,Lafayette
MS:Jackson,Gulfport
KY:Louisville,Lexington
VA:Virginia Beach,Richmond,Norfolk,Chesapeake
MD:Baltimore,Frederick
PA:Philadelphia,Pittsburgh,Allentown
NJ:Newark,Jersey City,Toms River
NY:Buffalo,Rochester,Syracuse,Long Island
MA:Boston,Worcester
CT:Hartford,New Haven
WA:Seattle,Spokane,Tacoma
OR:Portland,Eugene,Bend
ID:Boise,Meridian
NM:Albuquerque,Las Cruces
MT:Billings
SD:Sioux Falls
ND:Fargo
DE:Wilmington
WV:Charleston
NH:Manchester
ME:Portland
SC:Spartanburg"""
METROS = {"DFW": ["Dallas", "Fort Worth", "Arlington", "Plano", "Frisco", "McKinney", "Denton", "Garland", "Irving"],
          "HOU": ["Houston", "Katy", "The Woodlands", "Sugar Land"], "SAT": ["San Antonio"],
          "AUS": ["Austin", "Round Rock"]}


def cities_for(state):
    out = []
    for line in CITY_TABLE.splitlines():
        st, _, names = line.partition(":")
        if st == state:
            out += [c.strip() for c in names.split(",") if c.strip() not in out]
    return out


def load_env():
    env = HERE.parent / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def need(name):
    v = os.environ.get(name)
    if not v:
        sys.exit("%s not set (environment or .env)" % name)
    return v


# ---------- storage ----------
def db_open(path):
    db = sqlite3.connect(path)
    db.executescript("""
    CREATE TABLE IF NOT EXISTS ads(ad_id TEXT PRIMARY KEY, page_id TEXT, page_name TEXT, page_url TEXT, link_url TEXT,
      text TEXT, niche TEXT, search_city TEXT, search_state TEXT, source TEXT, seen_at TEXT);
    CREATE INDEX IF NOT EXISTS ads_page ON ads(page_id, niche);
    CREATE TABLE IF NOT EXISTS leads(page_id TEXT, niche TEXT, name TEXT, city TEXT, state TEXT, ads INTEGER, website TEXT,
      facebook TEXT, status TEXT, reason TEXT, owner TEXT, best_phone TEXT, phones TEXT, notes TEXT, row_json TEXT,
      enriched_at TEXT, called TEXT DEFAULT '', PRIMARY KEY(page_id, niche));
    CREATE TABLE IF NOT EXISTS runs(ts TEXT, kind TEXT, detail TEXT, treg_usd REAL, apify_usd REAL, firecrawl_credits INTEGER);
    CREATE TABLE IF NOT EXISTS searched(niche TEXT, phrase TEXT, city TEXT, ts TEXT, ads INTEGER, PRIMARY KEY(niche, phrase, city));
    """)
    for col in ("start_ts", "end_ts"):  # added later; older databases get the columns on open
        try:
            db.execute("ALTER TABLE ads ADD COLUMN %s INTEGER" % col)
        except sqlite3.OperationalError:
            pass
    return db


# ---------- census ----------
def treg_search(query, cursor, cap):
    body = {"query": query, "country": "US", "status": "ACTIVE", "searchType": "keyword_unordered"}
    if cursor:
        body["cursor"] = cursor
    req = urllib.request.Request(TREG, json.dumps(body).encode(), {
        "X-Treg-Token": need("TREG_API_KEY_KYNETICAI"), "X-Treg-Route-Max-Cost": str(cap),
        "Content-Type": "application/json"})
    for wait in (0, 5, 15):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                SPEND["treg"] += int(r.headers.get("x-treg-cost-micro", 0)) / 1e6
                data = ((json.load(r).get("output") or {}).get("data")) or {}
                return data.get("ads", []), data.get("nextCursor")
        except urllib.error.HTTPError as e:
            if e.code == 402 and b"insufficient_balance" in e.read():
                raise RuntimeError("Treg balance is empty: add funds at https://treg.to/app#billing")
            if e.code not in (429, 500, 502, 503):
                raise
    return [], None


def to_ts(v):
    """Epoch seconds from Treg (epoch string) or Apify ('YYYY-MM-DD')."""
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return int(time.mktime(time.strptime(str(v)[:10], "%Y-%m-%d")))
        except ValueError:
            return None


def store_ads(db, rows, niche, city, state, source):
    n = 0
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for r in rows:
        if not r["ad_id"] or not r["page_id"]:
            continue
        cur = db.execute("INSERT OR IGNORE INTO ads VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", (
            r["ad_id"], r["page_id"], r["page_name"], r["page_url"], r["link_url"], (r["text"] or "")[:700], niche, city,
            state, source, now, to_ts(r.get("start")), to_ts(r.get("end"))))
        n += cur.rowcount
    db.commit()
    return n


def census(db, niche, cities, state, args):
    phrases = NICHES[niche][0]
    for city in cities:
        for ph in phrases:
            if SPEND["treg"] >= args.budget:
                print("census budget reached ($%.3f)" % SPEND["treg"])
                return
            if db.execute("SELECT 1 FROM searched WHERE niche=? AND phrase=? AND city=?", (niche, ph, city)).fetchone() \
                    and not args.refresh:
                continue
            q, cursor, got = "%s %s" % (ph, city), None, 0
            for _ in range(args.pages):
                ads, cursor = treg_search(q, cursor, 0.01)
                rows = [{"ad_id": a.get("id"), "page_id": a.get("pageId"), "page_name": a.get("pageName", ""),
                         "page_url": a.get("pageUrl", ""), "link_url": a.get("linkUrl") or a.get("caption") or "",
                         "text": a.get("text", ""), "start": a.get("startDate"), "end": a.get("endDate")} for a in ads]
                got += store_ads(db, rows, niche, city, state, "treg")
                if not cursor or not ads or SPEND["treg"] >= args.budget:
                    break
            db.execute("INSERT OR REPLACE INTO searched VALUES(?,?,?,?,?)",
                       (niche, ph, city, time.strftime("%Y-%m-%d"), got))
            db.commit()
            print("  %-34s +%d new ads  (treg $%.4f)" % (q, got, SPEND["treg"]))


def census_apify(db, niche, cities, state, args):
    """Optional: Apify actor solidcode/meta-ads-library-scraper for the same phrases (uses your Apify credit)."""
    terms = ["%s %s" % (ph, c) for c in cities for ph in NICHES[niche][0]][:args.apify_terms]
    body = {"searchTerms": terms, "country": "US", "adActiveStatus": "ACTIVE", "maxResults": args.apify_max,
            "scrapeAdDetails": True, "includeAboutPage": True}
    url = ("https://api.apify.com/v2/acts/solidcode~meta-ads-library-scraper/run-sync-get-dataset-items"
           "?maxTotalChargeUsd=%s&timeout=280" % args.apify_cap)
    req = urllib.request.Request(url, json.dumps(body).encode(), {
        "Authorization": "Bearer " + need("APIFY_API_TOKEN"), "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        items = json.load(r)
    rows = [{"ad_id": a.get("adArchiveID"), "page_id": a.get("pageID"), "page_name": a.get("pageName", ""),
             "page_url": a.get("pageURL", ""), "link_url": a.get("ctaUrl") or a.get("ctaDomain") or "",
             "text": a.get("adText", ""), "start": a.get("startDate"), "end": a.get("endDate")} for a in items]
    SPEND["apify"] += 0.005 + 0.00108 * len(items)  # published per-ad price with both add-ons; actual is on the run page
    print("  apify: %d ads, %d new (est. $%.3f)" % (len(rows), store_ads(db, rows, niche, "apify", state, "apify"), SPEND["apify"]))


# ---------- Treg-only enrichment ----------
STOP = {"roofing", "roof", "roofs", "llc", "inc", "co", "corp", "company", "construction", "contracting", "contractors",
        "restoration", "restorations", "and", "the", "of", "services", "service", "exteriors", "general", "group", "pros"}
OWNER_TITLE = re.compile(r"owner|president|founder|ceo|chief executive|partner|principal|managing member|proprietor", re.I)


def treg_call(ep, body, cap=0.05):
    req = urllib.request.Request("https://treg.to/call/" + ep, json.dumps(body).encode(), {
        "X-Treg-Token": need("TREG_API_KEY_KYNETICAI"), "X-Treg-Route-Max-Cost": str(cap), "Content-Type": "application/json"})
    for wait in (0, 5, 15):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                SPEND["treg"] += int(r.headers.get("x-treg-cost-micro", 0)) / 1e6
                return (json.load(r).get("output") or {})
        except urllib.error.HTTPError as e:
            if e.code == 402 and b"insufficient_balance" in e.read():
                raise RuntimeError("Treg balance is empty: add funds at https://treg.to/app#billing")
            if e.code not in (429, 500, 502, 503):
                return {}
    return {}


def words(name):
    w = [x for x in re.findall(r"[a-z0-9]+", name.lower()) if x not in STOP]
    return w[:2] or re.findall(r"[a-z0-9]+", name.lower())[:2]


def same_name(a, b):
    return all(w in b.lower() for w in words(a))


def enrich_treg(b, owner_contacts=False):
    """Maps place -> company LinkedIn page -> owner-titled employees, all through Treg. Each owner is kept only if the
    LinkedIn title names this business; a business with no verified owner stays HOLD, never a guess."""
    row = {"business": b["name"], "website": b.get("website", ""), "facebook": b.get("facebook", ""), "phones": {},
           "owner_candidates": [], "notes": []}
    st = b.get("state") or ""
    place = None
    for p in ((treg_call("anyapi.google.serp.maps", {"query": b["name"], "location": "%s, %s" % (b.get("city", ""), st),
                                                      "limit": 3}).get("data") or {}).get("items") or []):
        if same_name(b["name"], p.get("name", "")):
            place = p
            break
    if place:
        m = re.search(r",\s*([A-Z]{2})\s+\d{5}", place.get("address", ""))
        row["maps"] = {"name": place["name"], "address": place.get("address"), "rating": place.get("rating"),
                       "reviews": place.get("reviewCount"), "url": place.get("url")}
        if place.get("phone"):
            row["phones"][place["phone"]] = ["Google Maps listing " + (place.get("url") or "")]
        row["website"] = row["website"] or place.get("website") or ""
        if m and st and m.group(1) != st:
            row["status"], row["reason"] = "DROP", "Maps listing is in %s, not %s" % (m.group(1), st)
            return row
    else:
        row["notes"].append("no matching Google Maps listing")
    for ph in b.get("ad_phones", []):
        row["phones"].setdefault(ph, []).append("Meta ad text")
    dom = re.sub(r"^https?://(www\.)?", "", row["website"]).split("/")[0] if row["website"] else ""
    comp = treg_call("treg.companies.enrich", {"domain": dom}) if dom else {}
    li = comp.get("linkedin_url") if comp.get("name") and same_name(b["name"], comp["name"]) else None
    if comp.get("linkedin_url") and not li:
        row["notes"].append("LinkedIn page %s is a different company; ignored" % comp.get("name"))
    for pe in ((treg_call("anyapi.linkedin.company.people", {"company": li, "jobTitle": "owner OR president OR founder OR CEO OR partner",
                                                           "limit": 3}, 0.12).get("data") or {}).get("items") or []) if li else []:
        title = pe.get("jobTitle", "")
        if OWNER_TITLE.search(title) and same_name(b["name"], title.split(" at ", 1)[-1]):
            row["owner_candidates"].append({"name": pe["name"], "role": title, "source": pe.get("url"),
                                            "confidence": "MEDIUM (LinkedIn title names this business)"})
    if owner_contacts and row["owner_candidates"]:
        o = row["owner_candidates"][0]
        ph = treg_call("treg.people.phone.find", {"linkedin_url": o["source"]}, 0.05).get("phone")
        if ph:
            row["phones"].setdefault(ph, []).append("Treg phone finder for " + o["name"] + " (owner direct)")
            o["direct_phone"] = ph
        em = treg_call("treg.people.email.find", {"domain": dom, "full_name": o["name"]}, 0.05).get("email") if dom else None
        if em:
            o["email"] = em
    phones = [p for p in row["phones"] if p[2:5] not in ("800", "833", "844", "855", "866", "877", "888")]
    owner_phone = next((o["direct_phone"] for o in row["owner_candidates"] if o.get("direct_phone")), None)
    row["best_phone"] = owner_phone or (phones[0] if len(phones) == 1 or place and place.get("phone") in phones else "")
    row["best_phone"] = row["best_phone"] or (phones[0] if phones else "")
    if row["owner_candidates"] and row["best_phone"]:
        row["status"], row["reason"] = "DIAL_READY", "owner from LinkedIn, phone from " + (
            "owner direct dial" if owner_phone else "Google Maps listing (business line)")
    else:
        row["status"] = "HOLD"
        row["reason"] = "missing: " + ", ".join(x for x, ok in (("verified owner", bool(row["owner_candidates"])),
                                                                ("phone", bool(row["best_phone"]))) if not ok)
    row["notes"].append("AI-answering check not run (Treg-only)")
    return row


# ---------- candidates + enrichment ----------
def site_of(link):
    if not link:
        return ""
    u = link if link.startswith("http") else "https://" + link
    host = urllib.parse.urlparse(u).netloc.lower().removeprefix("www.")
    return "" if host in SOCIAL else u.split("?")[0]


def candidates(db, niche, state, min_ads):
    name_re = re.compile(NICHES[niche][1], re.I)
    rows = db.execute("""SELECT page_id, MAX(page_name), MAX(page_url), COUNT(*) n, GROUP_CONCAT(link_url, ' '),
        GROUP_CONCAT(text, ' '), search_city, search_state FROM ads WHERE niche=? GROUP BY page_id
        HAVING n>=? ORDER BY n DESC""", (niche, min_ads)).fetchall()
    done = {r[0] for r in db.execute("SELECT page_id FROM leads WHERE niche=?", (niche,))}
    out = []
    for pid, name, purl, n, links, text, city, st in rows:
        if pid in done or (state and st != state):
            continue
        low = name.lower()
        if not name_re.search(name) or any(b in low for b in BRANDS) or st in BLOCKED_STATES:
            continue
        site = next((s for s in (site_of(x) for x in links.split(" ") if x) if s), "")
        phones = sorted({"(%s) %s-%s" % m for m in PHONE_RE.findall(text or "")})
        out.append({"page_id": pid, "name": name.strip(), "facebook": purl, "website": site, "ad_phones": phones,
                    "ads": n, "city": city, "state": st or ""})
    return out


def enrich_run(db, niche, state, args):
    if args.enricher == "treg":
        return enrich_loop(db, niche, state, args, lambda b: enrich_treg(b, args.owner_contacts))
    import lead_enrich as le  # BBB, Texas registry, Comptroller, site scan, screens
    le.CREDITS["max"] = args.max_credits
    le.METRO_CITIES = type("AnyCity", (set,), {"__contains__": lambda s, x: True})()  # national: any city in-state is fine
    le.METRO_AREA_CODES = {str(n) for n in range(200, 1000)}
    orig_registry = le.registry

    def fire(b):
        le.TARGET_STATE = b["state"].lower() if b["state"] else "tx"
        le.registry = orig_registry if b["state"] == "TX" else (lambda name: ([], None))  # registry = Texas open data only
        return le.enrich(b)
    enrich_loop(db, niche, state, args, fire)
    le.registry = orig_registry
    return le.CREDITS["used"]


def enrich_loop(db, niche, state, args, fn):
    cands = candidates(db, niche, state, args.min_ads)[:args.max_enrich]
    print("enriching %d candidates (min %d ads)" % (len(cands), args.min_ads))
    for b in cands:
        st = b["state"]
        if args.enricher == "treg" and SPEND["treg"] >= args.enrich_budget:
            print("enrich budget reached ($%.3f)" % SPEND["treg"])
            break
        try:
            row = fn(b)
        except RuntimeError as e:
            print("stopped:", e)
            break
        except Exception as e:  # one bad site must not stop the run
            row = {"business": b["name"], "status": "HOLD", "reason": "enrich error: %s" % str(e)[:120], "phones": {},
                   "owner_candidates": [], "notes": []}
        owner = " | ".join(o["name"][:60] for o in row.get("owner_candidates", [])[:2])
        db.execute("INSERT OR REPLACE INTO leads VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE((SELECT called FROM leads WHERE page_id=? AND niche=?),''))",
                   (b["page_id"], niche, b["name"], b["city"], st, b["ads"], b["website"], b["facebook"],
                    row.get("status"), row.get("reason"), owner, row.get("best_phone", ""),
                    json.dumps(row.get("phones", {})), "; ".join(row.get("notes", [])), json.dumps(row),
                    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), b["page_id"], niche))
        db.commit()
        print("  %-8s %s (%s)" % (row.get("status"), b["name"], row.get("reason", "")[:70]))
    return 0


# ---------- ad spend estimate ----------
# Meta does not publish spend for commercial ads in the US, so this is a proxy, not data: live ads
# x an assumed daily budget per live ad x 30. Ads in one ad set share a budget, so the per-ad rates are low. Both rates
# are assumptions for local-service lead ads, not measured; change them.
DAILY_LOW, DAILY_HIGH = 3, 10


def spend_estimate(db, page_id, niche):
    now = time.time()
    rows = db.execute("SELECT text, start_ts FROM ads WHERE page_id=? AND niche=?", (page_id, niche)).fetchall()
    creatives = {(t or "")[:80] for t, _ in rows}
    starts = [st for _, st in rows if st]
    n = len(creatives)
    out = {"live_ads": len(rows), "creatives": n,
           "oldest_days": int((now - min(starts)) / 86400) if starts else "",
           "new_30d": sum(1 for st in starts if now - st < 30 * 86400)}
    lo, hi = len(rows) * DAILY_LOW * 30, len(rows) * DAILY_HIGH * 30
    out["spend_month_low"], out["spend_month_high"] = lo, hi
    out["spend_tier"] = ("under $1k" if hi < 1000 else "$1-3k" if lo < 3000 and hi < 10000 else
                         "$3-10k" if lo < 10000 else "$10k+")
    return out


# ---------- export, mark, stats ----------
EXPORT_COLS = ["name", "status", "owner", "best_phone", "city", "state", "niche", "live_ads", "oldest_ad_days",
               "new_ads_30d", "website", "facebook_page", "ad_library_link",
               "all_phones", "reason", "notes", "meta_page_id"]  # most important first, everything else after


def lead_rows(db, args):
    q, p = "SELECT niche,name,city,state,status,owner,best_phone,phones,website,facebook,ads,reason,notes,page_id,row_json FROM leads WHERE 1=1", []
    for cond, val in (("status=?", args.status), ("niche=?", args.niche), ("state=?", args.state)):
        if val:
            q += " AND " + cond
            p.append(val)
    if args.uncalled:
        q += " AND called=''"
    out = []
    for r in db.execute(q + " ORDER BY status='DIAL_READY' DESC, ads DESC", p).fetchall():
        e = spend_estimate(db, r[13], r[0])
        ad = db.execute("SELECT ad_id FROM ads WHERE page_id=? AND niche=? LIMIT 1", (r[13], r[0])).fetchone()
        row = json.loads(r[14] or "{}")
        out.append({"name": r[1], "status": r[4], "owner": r[5], "best_phone": r[6], "city": r[2], "state": r[3], "niche": r[0],
                    "spend_tier": e["spend_tier"], "live_ads": e["live_ads"], "oldest_ad_days": e["oldest_days"],
                    "new_ads_30d": e["new_30d"], "est_spend_month_low": e["spend_month_low"],
                    "est_spend_month_high": e["spend_month_high"], "website": r[8], "facebook_page": r[9],
                    "ad_library_link": ("https://www.facebook.com/ads/library/?id=" + ad[0]) if ad else "",
                    "all_phones": ", ".join(json.loads(r[7] or "{}")), "reason": r[11], "notes": r[12], "meta_page_id": r[13],
                    "_owner_candidates": row.get("owner_candidates", []), "_maps": row.get("maps", {})})
    return out


def export(db, path, args):
    rows = lead_rows(db, args)
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=EXPORT_COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print("exported %d leads to %s (most important columns first)" % (len(rows), path))


# Twenty mapping. The 10 engine fields and the 6 extra niche options were created in Twenty on 2026-10-22 (Abdullah's yes).
# Dry run only: this writes a JSON file, nothing is sent to Twenty.
TWENTY_NICHE = {"roofing": "ROOFING", "foundation": "FOUNDATION_REPAIR", "hvac": "HVAC", "pools": "POOL", "bath": "BATH",
                "kitchen": "KITCHEN", "windows": "WINDOWS", "siding": "SIDING", "fence": "FENCE", "concrete": "CONCRETE",
                "restoration": "WATER_DAMAGE_RESTORATION"}
TWENTY_NEW_FIELDS = ["metaPageId (text, unique key)", "facebookPageUrl (links)", "liveAds (number)", "oldestAdDays (number)",
                     "newAds30d (number)", "engineStatus (select DIAL_READY/HOLD)", "engineReason (text)", "state (text)",
                     "niche options: BATH, KITCHEN, WINDOWS, SIDING, FENCE, CONCRETE"]


def twenty_payload(db, path, args):
    items = []
    for r in lead_rows(db, args):
        if r["status"] == "DROP":
            continue
        company = {"name": r["name"], "domainName": {"primaryLinkUrl": r["website"]} if r["website"] else None,
                   "phone": r["best_phone"], "leadSource": "SCRAPE", "metaAdsActive": True, "leadStatus": "NEW",
                   "niche": TWENTY_NICHE.get(r["niche"], "OTHER"),
                   "adLibraryUrl": {"primaryLinkUrl": r["ad_library_link"]}, "ownerGate": "OWNER_UNVERIFIED",
                   "googleRating": r["_maps"].get("rating"), "reviewCount": r["_maps"].get("reviews"),
                   "metaPageId": r["meta_page_id"], "facebookPageUrl": r["facebook_page"],
                   "liveAds": r["live_ads"], "oldestAdDays": r["oldest_ad_days"], "newAds30d": r["new_ads_30d"],
                   "engineStatus": r["status"], "engineReason": r["reason"], "state": r["state"]}
        people = [{"name": o["name"], "jobTitle": o.get("role"), "contactRole": "OWNER", "linkedinLink": o.get("source"),
                   "email": o.get("email"), "phone": o.get("direct_phone")} for o in r["_owner_candidates"][:2]]
        items.append({"match_on": "metaPageId, then domainName", "company": company, "people": people})
    Path(path).write_text(json.dumps({"new_fields_needed": TWENTY_NEW_FIELDS, "records": items}, indent=1))
    print("wrote %d records to %s (dry run, nothing sent to Twenty)" % (len(items), path))


def stats(db):
    print("ads stored:", db.execute("SELECT COUNT(*) FROM ads").fetchone()[0],
          "| advertisers:", db.execute("SELECT COUNT(DISTINCT page_id) FROM ads").fetchone()[0])
    for r in db.execute("SELECT niche, status, COUNT(*), SUM(called<>'') FROM leads GROUP BY niche, status ORDER BY niche, status"):
        print("  %-12s %-11s %4d leads (%d called)" % r)
    t = db.execute("SELECT SUM(treg_usd), SUM(apify_usd), SUM(firecrawl_credits) FROM runs").fetchone()
    print("spend to date: Treg $%.3f, Apify $%.3f, Firecrawl %d credits" % tuple(x or 0 for x in t))


def log_run(db, kind, detail, credits=0):
    db.execute("INSERT INTO runs VALUES(?,?,?,?,?,?)", (time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), kind,
                                                        detail, SPEND["treg"], SPEND["apify"], credits))
    db.commit()


# ---------- main ----------
def plan(args):
    if args.cities:
        return [c.strip() for c in args.cities.split(",")], (args.state or "").upper()
    if args.metro:
        return METROS[args.metro.upper()], "TX"
    return cities_for((args.state or "").upper()), (args.state or "").upper()


def run(args):
    load_env()
    db = db_open(args.db)
    niche = args.niche
    if niche not in NICHES:
        sys.exit("niche must be one of: " + ", ".join(NICHES))
    if args.cmd in ("run", "census"):
        targets = []
        if args.all_us:
            for line in CITY_TABLE.splitlines():
                st = line.split(":")[0]
                if st not in BLOCKED_STATES:
                    targets.append((st, cities_for(st)[:args.per_state]))
        else:
            cities, st = plan(args)
            if st in BLOCKED_STATES or not cities:
                sys.exit("no cities to search (FL and OK are never searched; pass --state, --metro or --cities)")
            targets.append((st, cities))
        for st, cities in targets:
            if SPEND["treg"] >= args.budget:
                break
            print("census %s %s: %d cities" % (niche, st, len(cities)))
            if args.source in ("treg", "both"):
                try:
                    census(db, niche, cities, st, args)
                except RuntimeError as e:
                    print("stopped:", e)
                    break
            if args.source in ("apify", "both"):
                census_apify(db, niche, cities, st, args)
    credits = 0
    if args.cmd in ("run", "enrich"):
        credits = enrich_run(db, niche, (args.state or "").upper() if not args.all_us else "", args)
    log_run(db, args.cmd, "%s %s" % (niche, args.state or args.metro or args.cities or "all-us"), credits)
    print("spend this run: Treg $%.4f, Apify $%.4f, Firecrawl %d credits" % (SPEND["treg"], SPEND["apify"], credits))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["run", "census", "enrich", "export", "twenty-payload", "mark", "stats"])
    ap.add_argument("target", nargs="*", help="export: output.csv | mark: <business name> <called|reset>")
    ap.add_argument("--db", default="leads.db")
    ap.add_argument("--niche", default="roofing")
    ap.add_argument("--state"), ap.add_argument("--metro"), ap.add_argument("--cities")
    ap.add_argument("--all-us", action="store_true")
    ap.add_argument("--per-state", type=int, default=6, help="cities per state with --all-us")
    ap.add_argument("--source", choices=["treg", "apify", "both"], default="treg")
    ap.add_argument("--budget", type=float, default=3.0, help="census stops at this many Treg dollars")
    ap.add_argument("--pages", type=int, default=3, help="result pages per search (~30 ads each)")
    ap.add_argument("--refresh", action="store_true", help="re-run searches already stored")
    ap.add_argument("--min-ads", type=int, default=2)
    ap.add_argument("--max-enrich", type=int, default=100)
    ap.add_argument("--enricher", choices=["treg", "firecrawl"], default="treg",
                    help="treg: Maps + LinkedIn, Treg only (~$0.02 per business). firecrawl: BBB, Texas registry, site scan")
    ap.add_argument("--owner-contacts", action="store_true", help="treg enricher: also look up the owner's direct phone and email")
    ap.add_argument("--enrich-budget", type=float, default=5.0, help="treg enricher stops at this many Treg dollars in total")
    ap.add_argument("--max-credits", type=int, default=500, help="Firecrawl credit cap for the enrich step")
    ap.add_argument("--apify-terms", type=int, default=10), ap.add_argument("--apify-max", type=int, default=500)
    ap.add_argument("--apify-cap", type=float, default=1.0)
    ap.add_argument("--status"), ap.add_argument("--uncalled", action="store_true")
    args = ap.parse_args()
    if args.cmd in ("run", "census", "enrich"):
        run(args)
        return
    db = db_open(args.db)
    if args.cmd == "stats":
        stats(db)
    elif args.cmd == "export":
        export(db, args.target[0] if args.target else "leads.csv", args)
    elif args.cmd == "twenty-payload":
        twenty_payload(db, args.target[0] if args.target else "twenty_import.json", args)
    elif args.cmd == "mark":
        name, how = " ".join(args.target[:-1]), args.target[-1]
        n = db.execute("UPDATE leads SET called=? WHERE name LIKE ?", (time.strftime("%Y-%m-%d") if how == "called" else "",
                                                                       name)).rowcount
        db.commit()
        print("marked %d lead(s)" % n)


# ---------- Modal (optional; deploy only after approval) ----------
try:
    import modal  # noqa: E402

    app = modal.App("kynetic-lead-engine")
    image = (modal.Image.debian_slim().add_local_python_source("lead_enrich", "lead_engine"))
    vol = modal.Volume.from_name("kynetic-leads", create_if_missing=True)

    @app.function(image=image, volumes={"/data": vol}, timeout=3600,
                  secrets=[modal.Secret.from_name("kynetic-lead-engine")])  # holds the 3 keys
    def run_job(niche="roofing", state="", metro="", cities="", all_us=False, budget=3.0, max_enrich=100):
        """Called by an n8n webhook (n8n form -> HTTP node). Writes /data/leads.db; n8n/Twenty import comes later."""
        sys.argv = ["lead_engine", "run", "--db", "/data/leads.db", "--niche", niche, "--budget", str(budget),
                    "--max-enrich", str(max_enrich)] + (["--state", state] if state else []) + \
                   (["--metro", metro] if metro else []) + (["--cities", cities] if cities else []) + \
                   (["--all-us"] if all_us else [])
        main()
        vol.commit()
except ImportError:
    pass

if __name__ == "__main__":
    main()
