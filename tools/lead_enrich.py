#!/usr/bin/env python3
"""Owner and phone enrichment for a list of businesses, using Firecrawl only.

Stands in for the manual browser research (Muse) on the sources that can be read
without filling in a form: Texas open data (franchise-tax permit holders),
the Comptroller account page, the BBB profile and the business's own site.
Standard library only. Reads FIRECRAWL_API_KEY from the environment or .env.
It only reads public pages. It never logs in, submits a form or contacts anyone.

Usage:
  python tools/lead_enrich.py input.json out_dir [--max-credits 120]
  python tools/lead_enrich.py --rescore results.json out_dir   (no API calls)

input.json: [{"name": "Bert Roofing Inc", "website": "https://bertroofing.com",
              "facebook": "https://www.facebook.com/BertRoofingInc/",
              "ad_phones": ["(972) 360-9690"], "city": "Dallas", "state": "TX"}, ...]
(ad_phones, city and state are optional and come from the ad census.)
Writes out_dir/results.json, results.csv and phone_report.csv. Anything it cannot source is
left "unknown"; it never guesses an owner. Status is DIAL_READY only when an owner
is named by BBB or the Comptroller and one phone is either the only number found
or the only one corroborated by two different sites. Screens run after the fetch:
geography (target metro, never FL/OK), franchise/lead-gen signals, and existing AI
call answering. --rescore reruns only those screens on a saved results.json.
"""
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.firecrawl.dev/v2"
SOCRATA = "https://data.texas.gov/resource/9cir-efmm.json"
CREDITS = {"used": 0, "max": 120}
PHONE_RE = re.compile(r"\(?\b([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-](\d{4})\b")
TOLL_FREE = {"800", "833", "844", "855", "866", "877", "888"}

# Target market. Cities are the DFW core (Dallas, Tarrant, Collin, Denton, Rockwall,
# Ellis, Johnson, Kaufman, Parker counties); a business outside them is kept only if it
# also publishes a DFW area code (e.g. Heirloom in Sherman), and is noted as outside core.
TARGET_STATE = "tx"
METRO_AREA_CODES = {"214", "469", "972", "945", "817", "682", "940"}
METRO_CITIES = set("""dallas fort-worth arlington plano garland irving grand-prairie mckinney frisco
mesquite carrollton denton richardson lewisville allen flower-mound north-richland-hills mansfield
rowlett euless desoto grapevine bedford cedar-hill wylie keller coppell hurst duncanville rockwall
the-colony burleson lancaster little-elm haltom-city southlake prosper midlothian waxahachie forney
weatherford cleburne sachse saginaw celina anna princeton royse-city azle benbrook crowley
farmers-branch addison colleyville watauga balch-springs seagoville red-oak glenn-heights ennis
terrell kaufman granbury aledo alvarado joshua highland-village corinth argyle trophy-club roanoke
fate heath murphy fairview lucas melissa sunnyvale richland-hills white-settlement lake-worth
kennedale everman forest-hill university-park highland-park justin northlake haslet krum sanger
aubrey pilot-point van-alstyne ovilla red-oak palmer ferris venus godley keene""".split())
CITY_ALIASES = {"n-richlnd-hls": "north-richland-hills", "n-richland-hills": "north-richland-hills",
                "ft-worth": "fort-worth", "grand-prarie": "grand-prairie"}
BLOCKED_STATES = {"fl", "ok"}  # never prospect Florida or Oklahoma
BLOCKED_AREA_CODES = {  # Florida and Oklahoma
    "239", "305", "321", "324", "352", "386", "407", "448", "561", "645", "656", "689", "727", "728",
    "754", "772", "786", "813", "850", "863", "904", "941", "954", "405", "539", "572", "580", "918"}

# Franchise / national brand / lead-gen signals (drop rule in the Run B prompt).
FRANCHISE_RE = re.compile(
    r"independently owned and operated|\bfranchis(?:e|ee|ed|ing)\b|find a location near you|"
    r"locations nationwide|serving \d+ states|get matched with|connect you with (?:a |local )?(?:pros|contractors)",
    re.I)
BRANDS = ["mighty dog roofing", "roofing corp of america", "roof maxx", "mr. roof", "leaffilter",
          "leafguard", "power home remodeling", "erie home", "renewal by andersen", "window nation",
          "bath fitter", "re-bath", "west shore home", "bath planet", "five star bath", "kitchen tune-up",
          "aire serv", "one hour heating", "roto-rooter", "mr. rooter", "ars rescue rooter", "long roofing",
          "storm guard", "dryer vent wizard", "homeadvisor", "angi", "modernize"]  # checked against name and domain only

# Existing AI call answering or AI lead follow-up (HOLD: already has what Plan 1 sells),
# matched in the home page HTML, and plain chat widgets (noted only, not a reason to drop).
AI_ANSWERING = {"alivo": "Alivo AI answering", "goodcall": "Goodcall AI agent", "smith.ai": "Smith.ai",
                "myaifrontdesk": "My AI Front Desk", "dialzara": "Dialzara", "heyrosie": "Rosie AI",
                "synthflow": "Synthflow", "retellai": "Retell", "vapi.ai": "Vapi", "bland.ai": "Bland",
                "numahelpers": "Numa", "hatchapp": "Hatch AI follow-up",
                "answerconnect": "AnswerConnect", "ruby.com": "Ruby receptionists", "rosie.ai": "Rosie AI"}
AI_TEXT_RE = re.compile(
    r"\bAI[- ](?:receptionist|phone (?:agent|assistant)|answering|voice (?:agent|assistant))|"
    r"virtual receptionist|24/7 (?:live )?(?:answering|call center)", re.I)
CHAT_WIDGETS = {"podium.com": "Podium", "birdeye.com": "Birdeye", "leadconnectorhq": "GoHighLevel chat",
                "msgsndr": "GoHighLevel chat", "widget.intercom.io": "Intercom", "js.driftt": "Drift", "tidio": "Tidio",
                "livechatinc": "LiveChat", "tawk.to": "Tawk.to", "chatbase": "Chatbase", "voiceflow": "Voiceflow",
                "scheduleengine": "ServiceTitan Schedule Engine", "nicejob": "NiceJob",
                "housecallpro": "Housecall Pro", "getjobber": "Jobber", "roofr.com": "Roofr", "signpost.com": "Signpost"}
BLOCK_RE = re.compile(r"just a moment\.\.\.|cf-chl|challenge-platform|verify you are human|attention required", re.I)


def load_key():
    key = os.environ.get("FIRECRAWL_API_KEY")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("FIRECRAWL_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    if not key:
        sys.exit("FIRECRAWL_API_KEY not set")
    return key


KEY = None


def post(path, body):
    global KEY
    KEY = KEY or load_key()
    if CREDITS["used"] >= CREDITS["max"]:
        raise RuntimeError("credit cap reached")
    req = urllib.request.Request(
        API + path, json.dumps(body).encode(),
        {"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    for wait in (0, 6, 15, 30):
        time.sleep(wait + 1)  # pace calls; Firecrawl rate-limits bursts (429)
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    raise RuntimeError("HTTP 429 after retries")


def scrape(url, fmt="markdown", also=None):
    formats = [fmt] + ([also] if also else [])
    try:
        out = post("/scrape", {"url": url, "formats": formats, "onlyMainContent": False})
    except Exception as e:  # blocked, timeout, cap
        return (None, None, str(e)) if also else (None, str(e))
    d = out.get("data", {})
    CREDITS["used"] += d.get("metadata", {}).get("creditsUsed", 1)
    return (d.get(fmt), d.get(also), None) if also else (d.get(fmt), None)


def search(query, domain):
    try:
        out = post("/search", {"query": query, "limit": 5, "includeDomains": [domain]})
    except Exception as e:
        return [], str(e)
    CREDITS["used"] += 2
    data = out.get("data", {})
    items = data.get("web", data) if isinstance(data, dict) else data
    return [i.get("url", "") for i in items if i.get("url")], None


def phones_in(text):
    found = {}
    for m in re.finditer(r"tel:\+?1?[\s-]?\(?(\d{3})\)?[\s.\-]?(\d{3})[\s.\-]?(\d{4})", text):
        found["(%s) %s-%s" % m.groups()] = "tel link"
    for m in PHONE_RE.finditer(text):
        found.setdefault("(%s) %s-%s" % m.groups(), "text")
    return found


def registry(name):
    words = re.sub(r"[^A-Za-z0-9& ]", "", name).upper().split()
    prefix = " ".join(words[:2])
    where = "upper(taxpayer_name) like '%s%%' and taxpayer_state='TX'" % prefix.replace("'", "''")
    url = SOCRATA + "?" + urllib.parse.urlencode({"$where": where, "$limit": "8"}, quote_via=urllib.parse.quote)
    raw, err = scrape(url, "rawHtml")
    if err or not raw:
        return [], err
    try:
        return json.loads(raw), None
    except ValueError:
        return [], "registry returned non-JSON"


def comptroller(taxpayer):
    url = "https://comptroller.texas.gov/taxes/franchise/account-status/search/" + taxpayer
    md, err = scrape(url)
    if not md:
        return {}, err
    g = lambda pat: (re.search(pat, md, re.S) or [None, ""])[1].strip()
    people = re.findall(r"\|\s*([A-Z /,&]+?)\s*\|\s*\*\*([^*]+)\*\*", md)
    return {
        "url": url,
        "entity": g(r"## ([^\n]+)\n\n\*\*Texas Taxpayer"),
        "right_to_transact": g(r"Right to Transact Business in Texas:\*\*\s*([A-Z]+)"),
        "registered_agent": g(r"Registered Agent Name:\*\*\s*([^\n*]+)"),
        "officers": [{"title": t.strip(), "name": n.strip()} for t, n in people],
    }, None


def bbb(name):
    urls, err = search(name + " Texas roofing BBB profile", "bbb.org")
    generic = {"roofing", "roof", "llc", "inc", "and", "the", "co", "company"}
    sig = [w for w in re.sub(r"[^a-z0-9 ]", " ", name.lower()).split() if w not in generic][:2]
    for u in urls:
        slug = re.sub(r"[^a-z0-9]", "", u.lower().split("/profile/")[-1])
        # both leading distinctive words must be in the BBB slug, else it is another business
        if "/profile/" in u and all(w in slug for w in sig):
            md, e = scrape(u.split("/customer-reviews")[0].split("/complaints")[0])
            if not md:
                return {}, e
            mg = re.search(r"Business Management:\s*(.+)", md)
            mgmt = mg.group(1).strip() if mg else ""
            main = re.search(r"\[\((\d{3})\) (\d{3}-\d{4})\]\(tel:", md)
            return {
                "url": u.split("/customer-reviews")[0],
                "management_raw": mgmt,
                "main_phone": "(%s) %s" % main.groups() if main else "",
                "other_phones": phones_in(md),
            }, None
    return {}, err or "no BBB profile found"


def site_signals(md, html):
    """What the home page shows about franchising and existing AI or chat answering."""
    low = (html or "").lower()
    sig = {"blocked": bool(BLOCK_RE.search((md or "")[:3000])),
           "ai_answering": sorted({v for k, v in AI_ANSWERING.items() if k in low}),
           "chat_widgets": sorted({v for k, v in CHAT_WIDGETS.items() if k in low}),
           "ai_claims": sorted({m.group(0) for m in AI_TEXT_RE.finditer(md or "")})[:3],
           "franchise_phrases": sorted({m.group(0).lower() for m in FRANCHISE_RE.finditer(md or "")})[:3]}
    sig["checked"] = bool(html) and not sig["blocked"]
    return sig


def website(url):
    out = {"phones": {}, "about_url": ""}
    md, html, err = scrape(url, "markdown", also="rawHtml")
    if not md:
        return out, err
    out["signals"] = site_signals(md, html)
    for p, how in phones_in(md).items():
        out["phones"].setdefault(p, []).append(url)
    link = re.search(r"\]\((https?://[^)\s]*(?:about|team|our-story|meet)[^)\s]*)\)", md, re.I)
    if link:
        out["about_url"] = link.group(1)
        md2, _ = scrape(link.group(1))
        if md2:
            more = site_signals(md2, "")["franchise_phrases"]
            out["signals"]["franchise_phrases"] = sorted(set(out["signals"]["franchise_phrases"]) | set(more))
            for p in phones_in(md2):
                out["phones"].setdefault(p, []).append(link.group(1))
            m = re.search(r"([^.\n]*\b(?:owner|founder|president|run by)\b[^.\n]*\.)", md2, re.I)
            out["owner_sentence"] = m.group(1).strip()[:250] if m else ""
    return out, None


def slug(city):
    c = re.sub(r"[^a-z0-9]+", "-", (city or "").lower()).strip("-")
    return CITY_ALIASES.get(c, c)


def narrow_registry(cands, name, city):
    """Cut several registry hits down using evidence, never a guess: the trade word in the
    business name (ROOFING, CONSTRUCTION...) must be in the entity name, then the BBB city."""
    generic = {"llc", "inc", "and", "the", "co", "company", "&"}
    trade = [w for w in re.sub(r"[^A-Za-z ]", " ", name).upper().split()[2:] if w.lower() not in generic]
    how = []
    if trade:
        hit = [c for c in cands if any(w in c["taxpayer_name"].upper() for w in trade)]
        if hit and len(hit) < len(cands):
            cands, _ = hit, how.append("trade word")
    if len(cands) > 1 and city:
        hit = [c for c in cands if slug(c.get("taxpayer_city")) == slug(city)]
        if hit:
            cands, _ = hit, how.append("BBB city")
    return cands, " + ".join(how)


def bbb_place(url):
    m = re.search(r"bbb\.org/us/([a-z]{2})/([a-z0-9-]+)/", url or "")
    return (m.group(1), m.group(2)) if m else ("", "")


def enrich(b):
    t0 = time.time()
    c0 = CREDITS["used"]
    row = {"business": b["name"], "website": b.get("website", ""), "facebook": b.get("facebook", ""),
           "census_city": b.get("city", ""), "census_state": b.get("state", ""),
           "owner_candidates": [], "phones": {}, "notes": []}
    for p in b.get("ad_phones", []):
        m = PHONE_RE.search(p)
        if m:
            row["phones"].setdefault("(%s) %s-%s" % m.groups(), []).append("ad copy " + (b.get("facebook") or "Meta ad"))
    bb, bbb_err = bbb(b["name"])
    row["bbb"] = bb
    cands, err = registry(b["name"])
    if err:
        row["notes"].append("registry: " + err)
    row["registry_candidates"] = [
        "%s | %s %s | %s | RTT=%s" % (c["taxpayer_name"], c.get("taxpayer_city", ""), c.get("taxpayer_zip", ""),
                                   c["taxpayer_number"], c.get("right_to_transact_business_code"))
        for c in cands]
    pick, how = narrow_registry(cands, b["name"], bbb_place(bb.get("url"))[1]) if len(cands) > 1 else (cands, "")
    if len(pick) > 1:
        active = [c for c in pick if c.get("right_to_transact_business_code") == "A"]
        pick = active or pick
    if len(pick) == 1:
        row["registry_match"] = {"name": pick[0]["taxpayer_name"], "city": pick[0].get("taxpayer_city", ""),
                                 "rtt": pick[0].get("right_to_transact_business_code"), "picked_by": how or "only hit"}
        comp, e = comptroller(pick[0]["taxpayer_number"])
        row["comptroller"] = comp
        seen = set()
        for o in comp.get("officers", []):
            if (o["name"], o["title"]) in seen:
                continue
            seen.add((o["name"], o["title"]))
            row["owner_candidates"].append(
                {"name": o["name"], "role": o["title"], "source": comp["url"], "confidence": "HIGH (registry)"})
    elif pick:
        row["notes"].append("registry ambiguous (%d candidates); not guessed" % len(pick))
    else:
        row["notes"].append("no registry match on first two words")
    if bb.get("management_raw"):
        row["owner_candidates"].append(
            {"name": bb["management_raw"], "role": "BBB Business Management", "source": bb["url"],
             "confidence": "MEDIUM (BBB)"})
    elif bbb_err:
        row["notes"].append("bbb: " + bbb_err)
    if bb.get("main_phone"):
        row["phones"].setdefault(bb["main_phone"], []).append(bb["url"] + " (BBB main)")
    if b.get("website"):
        w, e = website(b["website"])
        row["site_signals"] = w.get("signals", {})
        for p, srcs in w["phones"].items():
            row["phones"].setdefault(p, []).extend(srcs)
        if w.get("owner_sentence"):
            row["owner_candidates"].append(
                {"name": w["owner_sentence"], "role": "site sentence", "source": w["about_url"],
                 "confidence": "HIGH (own site), needs reading"})
        if e:
            row["notes"].append("website: " + e)
    else:
        row["notes"].append("no website supplied")
    classify(row)
    row["credits"] = CREDITS["used"] - c0
    row["seconds"] = round(time.time() - t0, 1)
    return row


def source_site(src):
    """The site a phone was read from; two pages of one site count once."""
    if src.startswith("ad copy"):
        return "meta ad"
    host = urllib.parse.urlparse(src.split(" ")[0]).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def phone_report(row):
    """Every phone with where it was seen, then the one to dial if the evidence picks one.
    A number wins only if two different sites show it and no other number has as many."""
    report = []
    for p, srcs in row.get("phones", {}).items():
        ac = p[1:4]
        sites = sorted({source_site(s) for s in srcs})
        region = ("toll-free" if ac in TOLL_FREE else "DFW" if ac in METRO_AREA_CODES
                  else "FL/OK" if ac in BLOCKED_AREA_CODES else "other")
        kinds = sorted({"BBB main" if "(BBB main)" in s else "ad copy" if s.startswith("ad copy")
                        else "own site" for s in srcs})
        report.append({"phone": p, "area": region, "sites": sites, "seen_on": kinds, "sources": srcs})
    dialable = [r for r in report if r["area"] in ("DFW", "other")]
    dialable.sort(key=lambda r: -len(r["sites"]))
    best, why = "", ""
    if len(dialable) == 1 and len(report) == 1:
        best, why = dialable[0]["phone"], "only number found"
    elif dialable and len(dialable[0]["sites"]) >= 2 and (len(dialable) == 1 or len(dialable[1]["sites"]) < len(dialable[0]["sites"])):
        best, why = dialable[0]["phone"], "on %d sites: %s" % (len(dialable[0]["sites"]), ", ".join(dialable[0]["sites"]))
    for r in report:
        r["pick"] = "DIAL" if r["phone"] == best else ""
        if r["seen_on"] == ["ad copy"] and len(report) > 1:
            r["note"] = "ad copy only; tracking number suspected"
        elif r["area"] in ("toll-free", "FL/OK"):
            r["note"] = "not dialed: " + r["area"]
    return report, best, why


def screens(row):
    """Geography, franchise and existing-AI checks. Returns (drop reasons, hold reasons, notes)."""
    drop, hold, notes = [], [], []
    st, city = bbb_place((row.get("bbb") or {}).get("url"))
    reg = row.get("registry_match") or {}
    if not city and reg.get("picked_by") not in (None, "", "only hit"):
        st, city = TARGET_STATE, slug(reg.get("city"))
    if not city and row.get("census_city"):
        st, city = (row.get("census_state") or "").lower(), slug(row["census_city"])
    city = CITY_ALIASES.get(city, city)
    codes = {p[1:4] for p in row.get("phones", {})}
    local = codes & METRO_AREA_CODES
    if st in BLOCKED_STATES:
        drop.append("based in %s (no FL/OK prospecting)" % st.upper())
    elif st and st != TARGET_STATE:
        drop.append("based out of state (%s)" % st.upper())
    elif city and city not in METRO_CITIES:
        if local:
            notes.append("based in %s, outside the DFW core, but publishes a DFW number" % city)
        else:
            drop.append("based in %s, outside DFW, no DFW number" % city)
    elif not city:
        notes.append("location not confirmed")
        if codes and not local and not codes <= TOLL_FREE:
            hold.append("no DFW area code among its phones")
    if codes & BLOCKED_AREA_CODES:
        notes.append("an FL/OK area code is listed (%s); not dialed" % ", ".join(sorted(codes & BLOCKED_AREA_CODES)))
    name = row.get("business", "").lower() + " " + urllib.parse.urlparse(row.get("website", "")).netloc.lower()
    brand = [x for x in BRANDS if re.search(r"(?<![a-z])" + re.escape(x) + r"(?![a-z])", name)]
    if brand:
        drop.append("national brand or lead-gen name: " + brand[0])
    sig = row.get("site_signals") or {}
    if sig.get("franchise_phrases"):
        hold.append("franchise wording on site: " + "; ".join(sig["franchise_phrases"]))
    if sig.get("ai_answering"):
        hold.append("site already runs AI call answering or follow-up: " + ", ".join(sig["ai_answering"]))
    if sig.get("ai_claims"):
        hold.append("site claims AI or 24/7 answering: " + "; ".join(sig["ai_claims"]))
    if sig.get("chat_widgets"):
        notes.append("chat/booking widget: " + ", ".join(sig["chat_widgets"]) + " (not a reason to drop)")
    if sig.get("blocked"):
        notes.append("site behind a bot check; AI-answering check not done")
    elif not sig.get("checked"):
        notes.append("AI-answering check not run")
    rtt = (row.get("comptroller") or {}).get("right_to_transact", "") or ""
    if (reg.get("rtt") == "N" or (rtt and rtt != "ACTIVE")):
        if reg.get("picked_by") == "only hit" and not city:
            notes.append("only registry hit %s is not active; match unconfirmed" % reg.get("name"))
        else:
            hold.append("registry: not active in Texas (right to transact %s)" % (rtt or "N"))
    if not row.get("website") and not (row.get("bbb") or {}).get("url") and not reg:
        hold.append("no site, BBB or registry entity found: lead-gen suspect, needs a Maps check")
    return drop, hold, notes


def classify(row):
    if row.get("comptroller") and "registry_match" not in row:  # results saved before registry_match existed
        c = row.get("registry_candidates", [])
        row["registry_match"] = {"name": c[0].split(" | ")[0] if len(c) == 1 else row["comptroller"].get("entity", ""),
                                 "city": c[0].split(" | ")[1].rsplit(" ", 1)[0] if len(c) == 1 else "",
                                 "rtt": c[0].rsplit("RTT=", 1)[1] if len(c) == 1 else "",
                                 "picked_by": "only hit" if len(c) == 1 else "active filter"}
    report, best, why = phone_report(row)
    row["phone_report"], row["best_phone"], row["best_phone_why"] = report, best, why
    row["phone_conflict"] = len(row.get("phones", {})) > 1
    row["toll_free_seen"] = any(p[1:4] in TOLL_FREE for p in row.get("phones", {}))
    drop, hold, notes = screens(row)
    row["screen_notes"] = notes
    has_owner = any(o["confidence"].startswith(("HIGH", "MEDIUM")) for o in row.get("owner_candidates", []))
    if drop:
        row["status"], row["reason"] = "DROP", "; ".join(drop)
    elif hold:
        row["status"], row["reason"] = "HOLD", "; ".join(hold)
    elif has_owner and best:
        row["status"] = "DIAL_READY"
        row["reason"] = "owner sourced; phone " + why
    elif has_owner and report:
        row["status"], row["reason"] = "HOLD", "owner sourced; phones disagree, pick by hand"
    else:
        row["status"] = "HOLD"
        row["reason"] = "missing: " + ", ".join(x for x, ok in (("owner", has_owner), ("phone", bool(report))) if not ok)
    return row


def write_outputs(rows, out):
    (out / "results.json").write_text(json.dumps(rows, indent=2))
    with open(out / "results.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["business", "status", "reason", "owner_candidates", "best_phone", "phones", "screen_notes",
                    "credits", "seconds", "notes"])
        for r in rows:
            w.writerow([r.get("business"), r.get("status"), r.get("reason"),
                        " || ".join("%s [%s; %s]" % (o["name"], o["role"], o["confidence"]) for o in r.get("owner_candidates", [])),
                        r.get("best_phone", ""),
                        " || ".join("%s <- %d src" % (p, len(s)) for p, s in r.get("phones", {}).items()),
                        "; ".join(r.get("screen_notes", [])),
                        r.get("credits"), r.get("seconds"), "; ".join(r.get("notes", []))])
    with open(out / "phone_report.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["business", "status", "phone", "pick", "area", "sites", "seen_on", "note", "sources"])
        for r in rows:
            for p in r.get("phone_report", []):
                w.writerow([r.get("business"), r.get("status"), p["phone"], p["pick"], p["area"], len(p["sites"]),
                            ", ".join(p["seen_on"]), p.get("note", ""), " | ".join(p["sources"])])


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
    if args[0] == "--rescore":
        out = Path(args[2]) if len(args) > 2 else Path(args[1]).parent
        out.mkdir(parents=True, exist_ok=True)
        rows = [classify(r) if r.get("status") != "SKIPPED" else r for r in json.loads(Path(args[1]).read_text())]
        write_outputs(rows, out)
        print("rescored", len(rows), "rows; no API calls")
        return
    if "--max-credits" in args:
        CREDITS["max"] = int(args[args.index("--max-credits") + 1])
    inp, out = Path(args[0]), Path(args[1])
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for b in json.loads(inp.read_text()):
        try:
            rows.append(enrich(b))
        except RuntimeError as e:
            rows.append({"business": b["name"], "status": "SKIPPED", "reason": str(e)})
            break
    write_outputs(rows, out)
    print("credits used:", CREDITS["used"])


if __name__ == "__main__":
    main()
