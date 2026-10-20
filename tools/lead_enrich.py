#!/usr/bin/env python3
"""Owner and phone enrichment for a list of businesses, using Firecrawl only.

Stands in for the manual browser research (Muse) on the sources that can be read
without filling in a form: Texas open data (franchise-tax permit holders),
the Comptroller account page, the BBB profile and the business's own site.
Standard library only. Reads FIRECRAWL_API_KEY from the environment or .env.
It only reads public pages. It never logs in, submits a form or contacts anyone.

Usage:
  python tools/lead_enrich.py input.json out_dir [--max-credits 120]

input.json: [{"name": "Bert Roofing Inc", "website": "https://bertroofing.com",
              "facebook": "https://www.facebook.com/BertRoofingInc/"}, ...]
Writes out_dir/results.json and out_dir/results.csv. Anything it cannot source is
left "unknown"; it never guesses an owner. Status is DIAL_READY only when an owner
is named by BBB or the Comptroller and a phone was found; the caller still has to
resolve conflicting phones.
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


KEY = load_key()


def post(path, body):
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


def scrape(url, fmt="markdown"):
    try:
        out = post("/scrape", {"url": url, "formats": [fmt], "onlyMainContent": False})
    except Exception as e:  # blocked, timeout, cap
        return None, str(e)
    d = out.get("data", {})
    CREDITS["used"] += d.get("metadata", {}).get("creditsUsed", 1)
    return d.get(fmt), None


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


def website(url):
    out = {"phones": {}, "about_url": ""}
    md, err = scrape(url)
    if not md:
        return out, err
    for p, how in phones_in(md).items():
        out["phones"].setdefault(p, []).append(url)
    link = re.search(r"\]\((https?://[^)\s]*(?:about|team|our-story|meet)[^)\s]*)\)", md, re.I)
    if link:
        out["about_url"] = link.group(1)
        md2, _ = scrape(link.group(1))
        if md2:
            for p in phones_in(md2):
                out["phones"].setdefault(p, []).append(link.group(1))
            m = re.search(r"([^.\n]*\b(?:owner|founder|president|run by)\b[^.\n]*\.)", md2, re.I)
            out["owner_sentence"] = m.group(1).strip()[:250] if m else ""
    return out, None


def enrich(b):
    t0 = time.time()
    c0 = CREDITS["used"]
    row = {"business": b["name"], "website": b.get("website", ""), "facebook": b.get("facebook", ""),
           "owner_candidates": [], "phones": {}, "notes": []}
    cands, err = registry(b["name"])
    if err:
        row["notes"].append("registry: " + err)
    row["registry_candidates"] = [
        "%s | %s %s | %s | RTT=%s" % (c["taxpayer_name"], c.get("taxpayer_city", ""), c.get("taxpayer_zip", ""),
                                   c["taxpayer_number"], c.get("right_to_transact_business_code"))
        for c in cands]
    active = [c for c in cands if c.get("right_to_transact_business_code") == "A"]
    pick = active if active else cands
    if len(pick) == 1:
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
    bb, e = bbb(b["name"])
    row["bbb"] = bb
    if bb.get("management_raw"):
        row["owner_candidates"].append(
            {"name": bb["management_raw"], "role": "BBB Business Management", "source": bb["url"],
             "confidence": "MEDIUM (BBB)"})
    elif e:
        row["notes"].append("bbb: " + e)
    if bb.get("main_phone"):
        row["phones"].setdefault(bb["main_phone"], []).append(bb["url"] + " (BBB main)")
    if b.get("website"):
        w, e = website(b["website"])
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
    distinct = list(row["phones"])
    row["phone_conflict"] = len(distinct) > 1
    row["toll_free_seen"] = any(p[1:4] in TOLL_FREE for p in distinct)
    has_owner = any(o["confidence"].startswith(("HIGH", "MEDIUM")) for o in row["owner_candidates"])
    if has_owner and distinct:
        row["status"] = "DIAL_READY" if not row["phone_conflict"] else "HOLD"
        row["reason"] = "owner sourced; phones disagree, pick by hand" if row["phone_conflict"] else "owner and one phone sourced"
    else:
        row["status"] = "HOLD"
        row["reason"] = "missing: " + ", ".join(x for x, ok in (("owner", has_owner), ("phone", bool(distinct))) if not ok)
    row["credits"] = CREDITS["used"] - c0
    row["seconds"] = round(time.time() - t0, 1)
    return row


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
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
    (out / "results.json").write_text(json.dumps(rows, indent=2))
    with open(out / "results.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["business", "status", "reason", "owner_candidates", "phones", "credits", "seconds", "notes"])
        for r in rows:
            w.writerow([r.get("business"), r.get("status"), r.get("reason"),
                        " || ".join("%s [%s; %s]" % (o["name"], o["role"], o["confidence"]) for o in r.get("owner_candidates", [])),
                        " || ".join("%s <- %d src" % (p, len(s)) for p, s in r.get("phones", {}).items()),
                        r.get("credits"), r.get("seconds"), "; ".join(r.get("notes", []))])
    print("credits used:", CREDITS["used"])


if __name__ == "__main__":
    main()
