"""
Kynetic Agency OS — Modal API
Endpoint: scrape_leads

Accepts a scrape request from n8n, runs the full pipeline, and writes results
directly to Notion. n8n only handles the trigger and the final Scrape Queries
row update — all lead creation happens here.

Deploy: modal deploy kynetic_agency_os_api.py
"""

import os
import re
import time
import modal
from fastapi import Header
from fastapi.responses import JSONResponse

# ── Modal app setup ───────────────────────────────────────────────────────────
image = modal.Image.debian_slim().pip_install(
    "httpx",
    "fastapi",
)

app = modal.App("kynetic-agency-os-api", image=image)

# ── Notion config ─────────────────────────────────────────────────────────────
OUTREACH_DB_ID  = "e1bb7f71-37b4-477b-aacc-c173dc60945b"
SCRAPE_LOG_DB_ID = "5934b8a7-6ad6-4190-b017-e7eafe9d4849"

# Property names in the 📥 Outreach Notion DB.
NOTION_PROPS = {
    "title":          "Business Name",    # title type
    "phone":          "Phone",            # phone_number type
    "city":           "City",             # rich_text type
    "state":          "State",            # rich_text type
    "website":        "Website",          # url type
    "google_maps_url": "Google Maps URL", # url type
    "rating":         "Rating",           # number type
    "review_count":   "Review Count",     # number type
    "niche":          "Niche",            # select type
    "status":         "Status",           # select type → "New Lead"
    "is_advertisement": "Is Advertisement", # checkbox type
    "lead_type":      "Lead Type",              # select type → "Franchise" | "Independent"
    "classification_notes": "Classification Notes", # rich_text type
}

# Niches whose dropdown label expands to multiple Apify search terms and/or
# maps to a different display name in Notion's Niche select. Anything not
# listed here is treated as a single literal search term with no remapping.
NICHE_SEARCH_TERMS = {
    "Restoration": ["Water damage restoration service", "Fire and water damage restoration"],
}
NICHE_DISPLAY_NAMES = {
    "Restoration": "Water/Fire/Storm Restoration",
}

# National franchise networks — checked before spending an OpenRouter call.
# Match against business name or website domain, case-insensitive substring.
FRANCHISE_BRANDS = [
    "servpro", "puroclean", "paul davis", "servicemaster", "1-800 water damage",
    "1-800watermaster", "rainbow international", "belfor", "restoration 1",
    "911 restoration", "aramsco", "rytech", "chem-dry", "flood doctor",
    "the cleanup guys", "steamatic", "action 1 restoration", "reconstruction experts",
    "first onsite", "bms cat", "cotton holdings",
]


# ── Helpers ───────────────────────────────────────────────────────────────────
def _bool(val):
    """Coerce n8n's string-typed booleans to real Python bools."""
    if isinstance(val, bool):
        return val
    return str(val).lower() == "true"


def _notion_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }


def _build_notion_properties(lead: dict, niche: str) -> dict:
    props = {}
    name = lead.get("business_name") or ""
    props[NOTION_PROPS["title"]] = {"title": [{"text": {"content": name}}]}

    phone = lead.get("phone") or None
    props[NOTION_PROPS["phone"]] = {"phone_number": phone}

    city = lead.get("city") or ""
    props[NOTION_PROPS["city"]] = {"rich_text": [{"text": {"content": city}}]}

    state = lead.get("state") or ""
    props[NOTION_PROPS["state"]] = {"rich_text": [{"text": {"content": state}}]}

    website = lead.get("website") or None
    props[NOTION_PROPS["website"]] = {"url": website}

    google_maps_url = lead.get("google_maps_url") or None
    props[NOTION_PROPS["google_maps_url"]] = {"url": google_maps_url}

    props[NOTION_PROPS["is_advertisement"]] = {"checkbox": bool(lead.get("is_advertisement"))}

    rating = lead.get("rating")
    if rating is not None:
        props[NOTION_PROPS["rating"]] = {"number": rating}

    review_count = lead.get("review_count")
    if review_count is not None:
        props[NOTION_PROPS["review_count"]] = {"number": review_count}

    props[NOTION_PROPS["niche"]] = {"select": {"name": niche}}
    props[NOTION_PROPS["status"]] = {"select": {"name": "New Lead"}}

    lead_type = lead.get("lead_type") or "Independent"
    props[NOTION_PROPS["lead_type"]] = {"select": {"name": lead_type}}

    notes = lead.get("classification_notes") or ""
    props[NOTION_PROPS["classification_notes"]] = {"rich_text": [{"text": {"content": notes[:2000]}}]}

    return props


# ── Franchise / Independent classification ─────────────────────────────────────
def _classify_lead(client, openrouter_key: str, lead: dict) -> tuple[str, str]:
    """
    Returns (lead_type, notes). Checks the static franchise-brand list first
    (free, no API call); falls through to one OpenRouter call only when the
    name/website don't obviously match a known franchise.
    """
    name = (lead.get("business_name") or "").lower()
    website = (lead.get("website") or "").lower()
    haystack = f"{name} {website}"

    for brand in FRANCHISE_BRANDS:
        if brand in haystack:
            return "Franchise", f"Matched known franchise brand '{brand}' in name/website."

    try:
        resp = client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {openrouter_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You classify local-service businesses as either a national "
                            "franchise/chain location or an independently-owned business. "
                            "Respond with strict JSON only: "
                            '{"classification": "Franchise" | "Independent", "reason": "<one short sentence>"}'
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Business name: {lead.get('business_name') or 'unknown'}\n"
                            f"Website: {lead.get('website') or 'none'}\n"
                            f"City: {lead.get('city') or 'unknown'}"
                        ),
                    },
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0,
            },
            timeout=20,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]

        import json
        parsed = json.loads(content)
        classification = parsed.get("classification") or "Independent"
        if classification not in ("Franchise", "Independent"):
            classification = "Independent"
        reason = (parsed.get("reason") or "").strip()[:300]
        return classification, reason or "OpenRouter classification, no reason given."
    except Exception as e:
        print(f"[Classify] OpenRouter call failed for {lead.get('business_name')}: {e}")
        return "Independent", "Classification failed (OpenRouter error) — defaulted to Independent."


# ── Notion Scrape Log dedup ───────────────────────────────────────────────────
def _is_duplicate(client, token: str, phone: str | None, name: str, city: str) -> bool:
    """Check the Scrape Log DB for an existing entry matching phone or name+city."""
    headers = _notion_headers(token)
    query_url = f"https://api.notion.com/v1/databases/{SCRAPE_LOG_DB_ID}/query"

    if phone:
        resp = client.post(
            query_url,
            headers=headers,
            json={"filter": {"property": "Phone", "phone_number": {"equals": phone}}, "page_size": 1},
            timeout=15,
        )
        time.sleep(0.35)
        if resp.status_code == 200 and resp.json().get("results"):
            return True

    if name and city:
        resp = client.post(
            query_url,
            headers=headers,
            json={
                "filter": {
                    "and": [
                        {"property": "Business Name", "title": {"equals": name}},
                        {"property": "City", "rich_text": {"equals": city}},
                    ]
                },
                "page_size": 1,
            },
            timeout=15,
        )
        time.sleep(0.35)
        if resp.status_code == 200 and resp.json().get("results"):
            return True

    return False


def _log_to_scrape_log(client, token: str, leads: list) -> None:
    """Insert new leads into the Scrape Log DB for future dedup."""
    headers = _notion_headers(token)
    for lead in leads:
        name = lead.get("business_name") or ""
        city = lead.get("city") or ""
        phone = lead.get("phone") or None
        payload = {
            "parent": {"database_id": SCRAPE_LOG_DB_ID},
            "properties": {
                "Business Name": {"title": [{"text": {"content": name}}]},
                "Phone":         {"phone_number": phone},
                "City":          {"rich_text": [{"text": {"content": city}}]},
            },
        }
        try:
            client.post("https://api.notion.com/v1/pages", headers=headers, json=payload, timeout=15)
            time.sleep(0.35)
        except Exception as e:
            print(f"[ScrapeLog] Failed to log {name}: {e}")


# ── Notion Outreach lead writer ───────────────────────────────────────────────
def _create_notion_leads(client, token: str, leads: list, niche: str) -> list:
    """Creates one Notion page per lead in the Outreach DB.
    Returns the subset of `leads` that were actually confirmed written —
    callers must not treat unwritten leads as added, and must not log them
    to Scrape Log (that would permanently hide them from future scrapes
    without them ever having landed in Outreach)."""
    headers = _notion_headers(token)
    written = []
    for lead in leads:
        payload = {
            "parent": {"database_id": OUTREACH_DB_ID},
            "properties": _build_notion_properties(lead, niche),
        }
        success = False
        for attempt in range(2):  # one retry on rate limit
            try:
                resp = client.post(
                    "https://api.notion.com/v1/pages",
                    headers=headers,
                    json=payload,
                    timeout=30,
                )
                if resp.status_code in (200, 201):
                    success = True
                    break
                if resp.status_code == 429 and attempt == 0:
                    retry_after = float(resp.headers.get("Retry-After", 1))
                    print(f"[Notion] 429 for {lead.get('business_name')}, retrying after {retry_after}s")
                    time.sleep(retry_after)
                    continue
                print(f"[Notion] Failed for {lead.get('business_name')}: "
                      f"{resp.status_code} {resp.text[:200]}")
                break
            except Exception as e:
                print(f"[Notion] Exception for {lead.get('business_name')}: {e}")
                break
        if success:
            written.append(lead)
        time.sleep(0.35)  # stay under Notion's ~3 req/s limit
    return written


# ── Modal endpoint ────────────────────────────────────────────────────────────
@app.function(
    secrets=[
        modal.Secret.from_name("api-auth-token"),
        modal.Secret.from_name("apify-secrets"),
        modal.Secret.from_name("notion-secrets"),
        modal.Secret.from_name("openrouter-api-key"),
    ],
    timeout=1200,  # bumped from 420s (Aug 21, 2026) — with the max_places
                   # ceiling raised to 500 and Restoration running 2 search
                   # terms, a deep fresh-city run can have hundreds of new
                   # leads, each needing a dedup check + classify call +
                   # throttled Outreach/Scrape-Log write, all serial. 1200s
                   # gives real headroom instead of failing mid-run.
)
@modal.fastapi_endpoint(method="POST")
def scrape_leads(data: dict, authorization: str = Header(None)):
    import httpx
    from fastapi import HTTPException

    # ── Auth ──────────────────────────────────────────────────────────────────
    expected = f"Bearer {os.environ['API_AUTH_TOKEN']}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # ── Parse inputs ──────────────────────────────────────────────────────────
    niche          = (data.get("niche") or "").strip()
    location       = (data.get("location") or "").strip()
    max_places     = int(data.get("max_places") or 50)
    website_filter = (data.get("website_filter") or "allPlaces").strip()
    skip_closed    = _bool(data.get("skip_closed", True))

    if not niche or not location:
        raise HTTPException(status_code=400, detail="niche and location are required")

    # No real ceiling anymore (Aug 21, 2026 — intentionally scraping deep per
    # city). 500 is a typo-guard, not a functional limit: Google Maps itself
    # rarely surfaces more than ~120-200 results for a single search+location
    # anyway, so this only stops something like an accidental extra zero.
    max_places = min(max(max_places, 1), 500)
    if website_filter not in ("allPlaces", "withWebsite", "withoutWebsite"):
        website_filter = "allPlaces"

    notion_token = os.environ["NOTION_TOKEN"]
    openrouter_key = os.environ["OPENROUTER_API_KEY"]

    # A dropdown niche like "Restoration" expands to multiple real Apify search
    # terms and gets a different, full display name written into Notion.
    search_terms = NICHE_SEARCH_TERMS.get(niche, [niche])
    notion_niche = NICHE_DISPLAY_NAMES.get(niche, niche)

    # ── Apify ─────────────────────────────────────────────────────────────────
    APIFY_TOKEN = os.environ["APIFY_TOKEN"]
    actor_id = "compass~crawler-google-places"
    run_url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"

    apify_input = {
        "searchStringsArray":        search_terms,
        "locationQuery":             location,
        "maxCrawledPlacesPerSearch": max_places,
        "language":                  "en",
        "website":                   website_filter,
        "skipClosedPlaces":          skip_closed,
    }

    print(f"[Apify] Scraping: {search_terms} in {location} (max {max_places})")
    client = httpx.Client()
    try:
        resp = client.post(
            run_url,
            params={"token": APIFY_TOKEN, "timeout": 600, "memory": 2048},
            json=apify_input,
            timeout=650,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Apify request failed: {e}")

    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=502,
            detail=f"Apify error {resp.status_code}: {resp.text[:300]}"
        )

    try:
        raw_places = resp.json()
    except Exception:
        raise HTTPException(status_code=502, detail="Apify returned non-JSON response")

    total_found = len(raw_places)
    print(f"[Apify] Got {total_found} raw results")

    # ── Normalise ─────────────────────────────────────────────────────────────
    def parse_address(address: str):
        """Best-effort city/state extraction from an Apify address string.
        Handles both '..., City, ST 12345, USA' and '..., City, ST 12345' —
        the old fixed addr_parts[-2] index broke depending on whether a
        trailing country segment was present."""
        parts = [p.strip() for p in (address or "").split(",") if p.strip()]
        if parts and parts[-1].upper() in ("USA", "UNITED STATES", "US"):
            parts = parts[:-1]
        city, state = "", ""
        if parts:
            m = re.match(r"^([A-Z]{2})\b", parts[-1])
            if m:
                state = m.group(1)
                if len(parts) >= 2:
                    city = parts[-2]
            else:
                city = parts[-1]
        return city, state

    def normalise(place):
        addr_city, addr_state = parse_address(place.get("address") or "")
        city = (place.get("city") or "").strip() or addr_city or location
        state = (place.get("state") or "").strip() or addr_state
        return {
            "business_name":    (place.get("title") or "").strip(),
            "phone":            (place.get("phone") or "").strip() or None,
            "city":             city.strip(),
            "state":            state,
            "website":          (place.get("website") or "").strip() or None,
            "google_maps_url":  (place.get("url") or "").strip() or None,
            "rating":           place.get("totalScore"),
            "review_count":     place.get("reviewsCount"),
            "is_advertisement": bool(place.get("isAdvertisement")),
        }

    candidates = [normalise(p) for p in raw_places if (p.get("title") or "").strip()]

    # ── Notion Scrape Log dedup ───────────────────────────────────────────────
    print(f"[ScrapeLog] Deduplicating {len(candidates)} candidates via Notion...")
    new_leads     = []
    leads_skipped = 0

    for lead in candidates:
        if _is_duplicate(client, notion_token, lead["phone"], lead["business_name"], lead["city"]):
            leads_skipped += 1
        else:
            new_leads.append(lead)

    print(f"[ScrapeLog] {len(new_leads)} new, {leads_skipped} skipped")

    # ── Franchise / Independent classification ────────────────────────────────
    if new_leads:
        print(f"[Classify] Classifying {len(new_leads)} leads...")
        for lead in new_leads:
            lead_type, notes = _classify_lead(client, openrouter_key, lead)
            lead["lead_type"] = lead_type
            lead["classification_notes"] = notes
        franchise_count = sum(1 for lead in new_leads if lead["lead_type"] == "Franchise")
        print(f"[Classify] {franchise_count} franchise, {len(new_leads) - franchise_count} independent")

    # ── Notion Outreach lead creation ─────────────────────────────────────────
    written_leads = []
    if new_leads:
        print(f"[Notion] Creating {len(new_leads)} pages in Outreach DB...")
        written_leads = _create_notion_leads(client, notion_token, new_leads, notion_niche)
        print(f"[Notion] Created {len(written_leads)} of {len(new_leads)} pages")

    leads_failed = len(new_leads) - len(written_leads)

    # Log to Scrape Log ONLY leads confirmed written to Outreach — logging an
    # unwritten lead here would permanently mark it "seen" and hide it from
    # every future scrape even though it never made it into Outreach.
    if written_leads:
        _log_to_scrape_log(client, notion_token, written_leads)
        print(f"[ScrapeLog] Logged {len(written_leads)} entries")

    client.close()

    # ── Return stats to n8n ───────────────────────────────────────────────────
    # leads_added reflects CONFIRMED Outreach writes, not just dedup survivors —
    # the two used to be conflated, which could overstate what actually landed.
    return JSONResponse({
        "success":              True,
        "leads_added":          len(written_leads),
        "leads_skipped":        leads_skipped,
        "leads_failed":         leads_failed,
        "total_found":          total_found,
        "notion_pages_created": len(written_leads),
    })
