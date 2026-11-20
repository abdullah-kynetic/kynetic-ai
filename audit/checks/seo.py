"""On-page and local SEO, read from the crawled pages. Original code; no upstream tool is copied."""

from __future__ import annotations

import re

from ..models import Business, CheckResult, Item
from ..net import now_iso
from .crawl import Crawl
from .page import digits_only, parse_page, phones_in
from .util import items_data, score_items, yes

LOCAL_TYPES = {
    "localbusiness", "homeandconstructionbusiness", "roofingcontractor", "generalcontractor", "hvacbusiness",
    "plumber", "electrician", "housepainter", "locksmith", "movingcompany", "autorepair", "autobodyshop",
    "automotivebusiness", "professionalservice", "legalservice", "attorney", "accountingservice",
    "realestateagent", "restaurant", "foodestablishment", "store", "healthandbeautybusiness", "dayspa",
    "beautysalon", "hairsalon", "nailsalon", "dentist", "medicalbusiness", "cleaningservice",
    "landscaping", "pestcontrol", "financialservice", "insuranceagency", "lodgingbusiness", "sportsactivitylocation",
}


def inspect_html(html: str) -> CheckResult:
    """Single-page summary kept for callers that pass HTML directly."""
    if any(marker in html.lower() for marker in ("captcha", "unusual traffic", "access denied")):
        return CheckResult("couldnt_check", reason="the page showed a bot challenge")
    facts = parse_page(html)
    return CheckResult("ok", {"title": facts.title, "h1_count": len(facts.h1),
                              "schema": bool(facts.jsonld_types), "indexable": not facts.noindex,
                              "has_contact_signal": any(x in facts.text.lower() for x in ("contact", "call us", "book"))})


def _is_local(types: list[str]) -> bool:
    return any(t.lower() in LOCAL_TYPES or t.lower().endswith(("business", "contractor")) for t in types)


def analyze_seo(crawl: Crawl, business: Business) -> CheckResult:
    if not crawl.pages:
        return CheckResult("couldnt_check", reason=crawl.error or "website could not be read",
                           tool="On-page SEO scan", observed_at=now_iso())
    home = parse_page(crawl.pages[0].html)
    others = [parse_page(p.html) for p in crawl.pages[1:]]
    everything = [home, *others]
    city = business.city.lower()
    industry_words = [w for w in re.findall(r"[a-z]{4,}", business.industry.lower())]
    items: list[Item] = []

    items.append(yes(crawl.final_url.startswith("https://"), "https", "Secure connection (HTTPS)",
                     "HTTPS", "No HTTPS", weight=1.5))
    title = home.title
    t_len = len(title)
    items.append(Item("title", "Home page title", "pass" if 30 <= t_len <= 65 else ("warn" if title else "fail"),
                      f'"{title[:80]}" ({t_len} characters)' if title else "Missing",
                      "Aim for 30-65 characters." if title else "", 1.5))
    items.append(yes(bool(city) and city in title.lower(), "title_city", "City named in the title",
                     "Yes", "No", "Local searches match on the city name.", miss="warn"))
    if industry_words:
        items.append(yes(any(w[:5] in title.lower() for w in industry_words), "title_service",
                         "Service named in the title", "Yes", "No", miss="warn"))
    desc = home.meta_description or ""
    items.append(Item("meta_description", "Meta description",
                      "pass" if 70 <= len(desc) <= 165 else ("warn" if desc else "fail"),
                      f"{len(desc)} characters" if desc else "Missing", "Google often shows this under your link."))
    items.append(Item("h1", "One main heading (H1)", "pass" if len(home.h1) == 1 else ("warn" if home.h1 else "fail"),
                      f"{len(home.h1)} found" + (f': "{home.h1[0][:60]}"' if home.h1 else "")))
    items.append(yes(home.viewport, "viewport", "Built for phones (viewport tag)", weight=1.5))
    items.append(yes(not home.noindex, "indexable", "Google is allowed to index the home page", "Yes",
                     "Blocked by noindex", weight=2))
    items.append(yes(bool(home.canonical), "canonical", "Canonical link", miss="warn"))
    all_types = sorted({t for f in everything for t in f.jsonld_types})
    items.append(Item("local_schema", "Local business schema (structured data)",
                      "pass" if _is_local(all_types) else ("warn" if all_types else "fail"),
                      ", ".join(all_types[:6]) if all_types else "None found",
                      "Tells Google your name, address, phone and hours in a format it trusts.", 1.5))
    items.append(yes(bool(home.og.get("og:title") or home.og.get("og:image")), "open_graph",
                     "Share preview tags (Open Graph)", miss="warn", weight=0.5))
    alt_total, alt_missing = home.images, home.images_missing_alt
    if alt_total:
        share = 1 - alt_missing / alt_total
        items.append(Item("alt_text", "Images with alt text", "pass" if share >= 0.8 else ("warn" if share >= 0.5 else "fail"),
                          f"{alt_total - alt_missing} of {alt_total}", weight=0.5))
    words = home.word_count
    items.append(Item("content", "Home page text", "pass" if words >= 300 else ("warn" if words >= 150 else "fail"),
                      f"About {words} words", "Thin pages give Google little to rank."))
    items.append(yes(crawl.robots is not None, "robots", "robots.txt file", miss="warn", weight=0.5))
    items.append(yes(crawl.sitemap_found, "sitemap", "XML sitemap",
                     f"Found ({crawl.sitemap_urls} URLs)" if crawl.sitemap_urls else "Found", "Not found", weight=0.75))
    site_phones = phones_in(" ".join(f.text for f in everything))
    if business.phone:
        wanted = digits_only(business.phone)
        items.append(yes(wanted in site_phones, "nap_phone", "Phone number matches the one you gave us",
                         "Matches", "Not found on the pages read",
                         "Name, address and phone should match everywhere you are listed."))
    else:
        items.append(yes(bool(site_phones), "nap_phone", "Phone number shown on the site",
                         ", ".join(f"({p[:3]}) {p[3:6]}-{p[6:]}" for p in site_phones[:2]) or "Yes", "Not found"))
    items.append(yes(bool(city) and city in " ".join(f.text.lower() for f in everything), "city_mention",
                     "City mentioned in page text", miss="warn"))
    service_pages = [p.url for p in crawl.pages[1:] if re.search(r"service|roof|repair|install|replace|remodel|"
                                                                  r"area|" + re.escape(city.replace(" ", "-")), p.url, re.I)]
    items.append(Item("service_pages", "Separate pages for services or areas",
                      "pass" if len(service_pages) >= 2 else ("warn" if service_pages else "fail"),
                      f"{len(service_pages)} among the {len(crawl.pages)} pages read", weight=0.75))

    return CheckResult("ok", {"items": items_data(items), "score": score_items(items),
                              "title": title, "h1_count": len(home.h1), "schema_types": all_types,
                              "indexable": not home.noindex, "phones": site_phones[:3]},
                       tool="On-page SEO scan", sources=tuple(p.url for p in crawl.pages), observed_at=now_iso())
