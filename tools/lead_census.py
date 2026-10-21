#!/usr/bin/env python3
"""Turn an Apify Meta Ad Library census (dataset items JSON) into lead_enrich.py input.

Free code filter, no API calls: group ads by Page ID, keep advertisers with 2+ active ads
and a target-market signal in ad text, About text or landing URL, drop non-roofers, and
write the list in the format lead_enrich.py reads.

Usage: python tools/lead_census.py ads.json out.json [--skip "Joe Hall,Rainstone"]
"""
import json
import re
import sys
from pathlib import Path

MARKET_RE = re.compile(r"\btexas\b|\bTX\b|dfw|dallas|fort worth|arlington|plano|frisco|mckinney|denton|"
                       r"north texas|tarrant|collin", re.I)
NOT_ROOFER_RE = re.compile(r"\brv\b|trailer|sheet metal|real estate|listings", re.I)
PHONE_RE = re.compile(r"\(?\b([2-9]\d{2})\)?[\s.\-]?(\d{3})[\s.\-](\d{4})\b")
NO_SITE = {"", "fb.me", "fb.com", "facebook.com", "l.facebook.com", "instagram.com"}


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
    skip = [s.strip().lower() for s in args[args.index("--skip") + 1].split(",")] if "--skip" in args else []
    pages = {}
    for a in json.loads(Path(args[0]).read_text()):
        p = pages.setdefault(a["pageID"], {"name": a["pageName"].strip(), "n": 0, "cat": a.get("pageCategory") or "",
                                           "fb": a.get("pageURL"), "cta": [], "text": a.get("pageAboutText") or ""})
        p["n"] += 1
        p["text"] += " " + (a.get("adText") or "")
        d = a.get("ctaDomain") or a.get("ctaUrl") or ""
        if d and d not in p["cta"]:
            p["cta"].append(d)
    out = []
    for p in sorted(pages.values(), key=lambda p: -p["n"]):
        name = p["name"]
        if p["n"] < 2 or not MARKET_RE.search(p["text"] + " ".join(p["cta"])):
            continue
        if NOT_ROOFER_RE.search(name + " " + p["cat"]) or any(s and s in name.lower() for s in skip):
            continue
        sites = [d for d in p["cta"] if re.sub(r"^https?://(www\.)?", "", d).split("/")[0] not in NO_SITE]
        site = sites[0] if sites else None
        if site and not site.startswith("http"):
            site = "https://" + site
        phones = sorted({"(%s) %s-%s" % m for m in PHONE_RE.findall(p["text"])})
        row = {"name": name, "facebook": p["fb"], "ad_phones": phones, "state": "TX", "ads": p["n"]}
        if site:
            row["website"] = site
        out.append(row)
    Path(args[1]).write_text(json.dumps(out, indent=1))
    print(len(out), "advertisers written to", args[1])


if __name__ == "__main__":
    main()
