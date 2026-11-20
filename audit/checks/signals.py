"""Lead capture and trust signals on the website. Keyword and widget detection only; nothing is submitted."""

from __future__ import annotations

import re

from ..models import CheckResult, Item
from ..net import now_iso
from .crawl import Crawl
from .page import parse_page
from .util import items_data, score_items, yes

BOOKING = {"calendly.com": "Calendly", "cal.com": "Cal.com", "housecallpro": "Housecall Pro", "getjobber": "Jobber",
           "jobber.com": "Jobber", "servicetitan": "ServiceTitan", "acuityscheduling": "Acuity", "setmore": "Setmore",
           "squareup.com/appointments": "Square Appointments", "vagaro": "Vagaro", "booksy": "Booksy",
           "schedulicity": "Schedulicity", "fresha": "Fresha", "mindbodyonline": "Mindbody", "opentable": "OpenTable",
           "resy.com": "Resy", "simplybook": "SimplyBook", "zocdoc": "Zocdoc", "workiz": "Workiz",
           "markate": "Markate", "leadconnectorhq": "GoHighLevel calendar", "msgsndr": "GoHighLevel calendar"}
CHAT = {"intercom": "Intercom", "drift.com": "Drift", "tawk.to": "Tawk.to", "livechatinc": "LiveChat",
        "podium": "Podium", "birdeye": "Birdeye", "hs-scripts": "HubSpot", "crisp.chat": "Crisp", "tidio": "Tidio",
        "zdassets": "Zendesk", "smartsupp": "Smartsupp", "olark": "Olark", "freshchat": "Freshchat",
        "leadconnectorhq": "GoHighLevel chat", "widget.manychat": "ManyChat", "gorgias": "Gorgias", "chatra": "Chatra",
        "botpress": "Botpress", "voiceflow": "Voiceflow", "chatbase": "Chatbase"}
REVIEW_WIDGETS = {"birdeye": "Birdeye", "podium": "Podium", "trustindex": "Trustindex", "elfsight": "Elfsight",
                  "embedsocial": "EmbedSocial", "reviewsonmywebsite": "Reviews on my website",
                  "grade.us": "Grade.us", "nicejob": "NiceJob", "trustpilot": "Trustpilot", "yotpo": "Yotpo"}
BADGES = ("gaf", "owens corning", "certainteed", "bbb", "better business bureau", "angi", "homeadvisor",
          "nari", "energy star", "lennox", "carrier", "trane", "ase certified", "i-car", "nahb", "houzz",
          "best of", "award", "certified", "accredited")
SOCIAL = {"facebook.com": "Facebook", "instagram.com": "Instagram", "yelp.com": "Yelp", "linkedin.com": "LinkedIn",
          "youtube.com": "YouTube", "tiktok.com": "TikTok", "nextdoor.com": "Nextdoor", "x.com/": "X",
          "twitter.com": "X", "houzz.com": "Houzz", "g.page": "Google", "maps.google": "Google",
          "goo.gl/maps": "Google", "google.com/maps": "Google", "maps.app.goo.gl": "Google"}


def _found(table: dict[str, str], hay: str) -> list[str]:
    return sorted({name for key, name in table.items() if key in hay})


def analyze_conversion(crawl: Crawl) -> CheckResult:
    if not crawl.pages:
        return CheckResult("couldnt_check", reason=crawl.error or "website could not be read",
                           tool="Lead capture scan", observed_at=now_iso())
    home_html = crawl.pages[0].html
    home_low = home_html.lower()
    all_low = crawl.all_html.lower()
    facts = [parse_page(p.html) for p in crawl.pages]
    text = " ".join(f.text.lower() for f in facts)
    items: list[Item] = []

    tel_at = home_low.find('href="tel:')
    if tel_at < 0:
        tel_at = home_low.find("href='tel:")
    body_at = max(0, home_low.find("<body"))
    near_top = tel_at >= 0 and (tel_at - body_at) < max(1, len(home_low) - body_at) * 0.25
    items.append(Item("click_to_call", "Tap-to-call phone link on the home page",
                      "pass" if near_top else ("warn" if tel_at >= 0 else "fail"),
                      "Near the top" if near_top else ("Lower on the page" if tel_at >= 0 else "Not found"),
                      "Most local customers search on a phone and want to tap to call.", 2))
    lead_forms = [f for f in (form for fa in facts for form in fa.forms)
                  if any(re.search(r"mail|phone|tel|name", field) for field in f["fields"]) and len(f["fields"]) >= 2]
    form_embeds = any(k in all_low for k in ("jotform", "typeform", "gravityforms", "wpforms", "hsforms",
                                            "formstack", "cognitoforms", "123formbuilder", "form.jotform"))
    items.append(yes(bool(lead_forms) or form_embeds, "lead_form", "Contact or estimate form",
                     f"{len(lead_forms)} form(s) found" if lead_forms else "Embedded form found", "Not found", weight=1.5))
    booking = _found(BOOKING, all_low)
    book_text = bool(re.search(r"book (?:online|now|an? (?:appointment|estimate|inspection|consult))|schedule (?:online|now|an?)", text))
    items.append(Item("online_booking", "Book online without a phone call",
                      "pass" if booking else ("warn" if book_text else "fail"),
                      ", ".join(booking) if booking else ("A booking button, no booking tool found" if book_text else "Not found"),
                      "Leads who can pick a time themselves are far less likely to call a competitor.", 1.5))
    chat = _found(CHAT, all_low)
    items.append(yes(bool(chat), "chat", "Chat or instant reply on the website", ", ".join(chat) or "Yes",
                     "Not found", "Visitors who arrive after hours get an answer now, not tomorrow.", weight=1.25))
    sms = "href=\"sms:" in all_low or "href='sms:" in all_low or bool(re.search(r"\btext us\b", text))
    items.append(yes(sms, "text_us", "Option to text the business", miss="warn"))
    after_hours = bool(re.search(r"24/7|24 hours|after[- ]hours|emergency", text))
    items.append(yes(after_hours, "after_hours", "Offers after-hours or emergency help", miss="warn", weight=0.75))
    offer = re.search(r"free (?:estimate|quote|inspection|consultation|assessment)s?", text)
    items.append(yes(bool(offer), "offer", "Clear free offer (estimate, quote, inspection)",
                     offer.group(0).capitalize() if offer else "Yes", "Not found", miss="warn"))
    financing = bool(re.search(r"financing|payment plans?|monthly payments|0% apr", text))
    items.append(yes(financing, "financing", "Financing or payment plans mentioned", miss="warn", weight=0.5))
    cta_count = len(re.findall(r"(?:get|request|schedule|book|call|claim)\s+(?:a |an |your |my )?(?:free )?"
                               r"(?:estimate|quote|inspection|appointment|consult|now|today|us)", facts[0].text.lower()))
    items.append(Item("cta_count", "Calls to action on the home page", "pass" if cta_count >= 2 else ("warn" if cta_count else "fail"),
                      f"{cta_count} found"))
    return CheckResult("ok", {"items": items_data(items), "score": score_items(items), "booking_tools": booking,
                              "chat_tools": chat, "lead_forms": len(lead_forms), "click_to_call": tel_at >= 0},
                       tool="Lead capture scan", sources=tuple(p.url for p in crawl.pages), observed_at=now_iso())


def analyze_trust(crawl: Crawl) -> CheckResult:
    if not crawl.pages:
        return CheckResult("couldnt_check", reason=crawl.error or "website could not be read",
                           tool="Trust signals scan", observed_at=now_iso())
    all_low = crawl.all_html.lower()
    facts = [parse_page(p.html) for p in crawl.pages]
    text = " ".join(f.text.lower() for f in facts)
    urls = " ".join(p.url.lower() for p in crawl.pages) + " " + " ".join(u.lower() for u, _ in crawl.links)
    items: list[Item] = []
    widgets = _found(REVIEW_WIDGETS, all_low)
    testimonials = bool(re.search(r"testimonial|what our (?:customers|clients) say|reviews?\b.*\bstars?|★", text))
    items.append(Item("reviews_on_site", "Customer reviews shown on the site",
                      "pass" if widgets or testimonials else "fail",
                      ", ".join(widgets) if widgets else ("Testimonials found" if testimonials else "Not found"),
                      "Visitors check reviews before they call. Showing them on your site keeps people there.", 1.5))
    license_match = re.search(r"(?:lic(?:ense)?\.?\s*(?:#|no\.?|number)\s*:?\s*[a-z0-9-]{4,})|cslb|roc\s*#?\s*\d{4,}", text)
    items.append(yes(bool(license_match), "license", "License number shown",
                     license_match.group(0)[:40].upper() if license_match else "Yes", "Not found", miss="warn"))
    items.append(yes(bool(re.search(r"\binsured\b|\bbonded\b|insurance", text)), "insured", "Insured or bonded mentioned",
                     miss="warn", weight=0.75))
    since = re.search(r"(?:since|established|est\.?|founded(?: in)?)\s+((?:19|20)\d{2})", text)
    years = re.search(r"(\d{1,3})\+?\s+years?\s+(?:of\s+)?(?:experience|in business|serving)", text)
    items.append(yes(bool(since or years), "experience", "Years in business stated",
                     (f"Since {since.group(1)}" if since else f"{years.group(1)}+ years") if (since or years) else "Yes",
                     "Not found", miss="warn", weight=0.75))
    items.append(yes(bool(re.search(r"warrant|guarantee", text)), "guarantee", "Warranty or guarantee", miss="warn"))
    badges = sorted({b for b in BADGES if re.search(r"\b" + re.escape(b) + r"\b", text)})
    items.append(yes(bool(badges), "badges", "Certifications, awards or memberships",
                     ", ".join(b.upper() if len(b) <= 4 else b.title() for b in badges[:5]), "Not found", miss="warn"))
    portfolio = bool(re.search(r"gallery|portfolio|projects|our work|before and after|before & after", text + " " + urls))
    items.append(yes(portfolio, "portfolio", "Photos of past work", miss="warn"))
    items.append(yes(bool(re.search(r"/about|about us|our team|meet the", urls + " " + text)), "about", "About or team page",
                     miss="warn", weight=0.5))
    items.append(yes("privacy" in urls or "privacy policy" in text, "privacy", "Privacy policy", miss="warn", weight=0.5))
    social = _found(SOCIAL, urls)
    items.append(yes(bool(social), "social", "Links to social and review profiles", ", ".join(social) or "Yes",
                     "Not found", miss="warn", weight=0.75))
    google_link = "Google" in social
    return CheckResult("ok", {"items": items_data(items), "score": score_items(items), "review_widgets": widgets,
                              "badges": badges, "social": social, "links_google_profile": google_link},
                       tool="Trust signals scan", sources=tuple(p.url for p in crawl.pages), observed_at=now_iso())


def inspect_signals(html: str) -> CheckResult:
    """Single-page summary kept for callers that pass HTML directly."""
    lower = html.lower()
    return CheckResult("ok", {"contact_form": "<form" in lower, "click_to_call": "tel:" in lower,
                              "booking": any(x in lower for x in ("book", "schedule"))})
