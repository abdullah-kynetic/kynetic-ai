import re
import asyncio
import time
from urllib.parse import quote_plus
from html.parser import HTMLParser
from ..models import CheckResult


class _MapsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.text: list[str] = []
        self._ignored = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() in {"script", "style"}:
            self._ignored += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style"} and self._ignored:
            self._ignored -= 1

    def handle_data(self, data: str) -> None:
        if not self._ignored:
            self.text.append(data.strip())


def _token_similarity(left: str, right: str) -> float:
    tokens_left = set(re.findall(r"[a-z0-9]+", left.lower()))
    tokens_right = set(re.findall(r"[a-z0-9]+", right.lower()))
    if not tokens_left or not tokens_right:
        return 0.0
    return len(tokens_left & tokens_right) / max(len(tokens_left), len(tokens_right))


def parse_maps_page(html: str, business_name: str | None = None) -> CheckResult:
    lowered = html.lower()
    if any(x in lowered for x in ("captcha", "unusual traffic", "access denied", "sorry")):
        return CheckResult("couldnt_check", reason="blocked")
    parser = _MapsParser()
    parser.feed(html)
    text = " ".join(parser.text)
    # Google changes class names frequently; visible text and aria-labels are more stable.
    aria = " ".join(re.findall(r"aria-label\s*=\s*[\"']([^\"']+)", html, re.I))
    title_match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title_text = title_match.group(1) if title_match else ""
    listing_prefix = re.split(r"\b(?:rating|rated|latest review|owner reply)\b", text, maxsplit=1, flags=re.I)[0]
    confirmed_name = business_name and any(
        _token_similarity(business_name, candidate) >= 0.6
        for candidate in (*parser.text, title_text, listing_prefix)
    )
    if not confirmed_name:
        return CheckResult("couldnt_check", reason="no confirmed listing")
    rating = (re.search(r"([0-5](?:\.[0-9])?)\s*stars?", aria, re.I)
              or re.search(r"(?:rating|rated)\s*[:：]?\s*([0-5](?:\.[0-9])?)", text, re.I))
    reviews = (re.search(r"([0-9][0-9,]*)\s*(?:reviews|ratings)", aria, re.I)
               or re.search(r"([0-9][0-9,]*)\s*(?:reviews|ratings)", text, re.I))
    dates = re.findall(r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}", text, re.I)
    competitors = re.findall(r"(?:competitor|nearby)[:\s]+([A-Z][A-Za-z0-9 &'-]{2,60})", text)
    if not rating or not reviews:
        title = (re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S) or [None, ""])[1]
        title_text = re.sub(r"\s+", " ", title or "").strip()[:120]
        reason = f"no confirmed listing (title={title_text!r}, html_length={len(html)})"
        return CheckResult("couldnt_check", reason=reason)
    category = re.search(r"(?:category|type)[:\s]+([^|<]{2,80})", text, re.I)
    category_value = category.group(1).strip() if category else None
    if category_value and re.search(r"[{};=]|\bfunction\b|=>", category_value, re.I):
        return CheckResult("couldnt_check", reason="no confirmed listing")
    return CheckResult("ok", {"rating": float(rating.group(1)),
        "review_count": int(reviews.group(1).replace(",", "")),
        "category": category_value,
        "latest_review_date": dates[-1] if dates else None,
        "owner_replies": len(re.findall(r"owner reply|response from the owner", text, re.I)),
        "top_competitors": competitors[:3]})


# ---------------------------------------------------------------------------------------------
# Public Google Maps reading (free tier). One headless browser, public pages only, no sign-in.
# Google shows a "limited view" to signed-out browsers, which hides review counts; those come with
# the paid Places upgrade. Everything shown here is what any visitor sees.
# ---------------------------------------------------------------------------------------------
import math
import shutil
from urllib.parse import unquote

from ..net import now_iso

_CARDS_JS = """() => [...document.querySelectorAll('a.hfpxzc')].map(a => {
  const card = a.closest('div[role=article]') || a.parentElement.parentElement;
  return {name: a.getAttribute('aria-label') || '', text: card ? card.innerText : '', href: a.href};
})"""
_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"


def similar(a: str, b: str) -> float:
    norm = lambda s: {t for t in re.findall(r"[a-z0-9]+", s.lower()) if t not in {"inc", "llc", "co", "the", "and", "company", "corp"}}
    left, right = norm(a), norm(b)
    if not left or not right:
        return 0.0
    return len(left & right) / min(len(left), len(right))


def parse_card(name: str, text: str) -> dict:
    lines = [l.strip() for l in text.splitlines() if l.strip() and l.strip() != name]
    pair = re.search(r"\b([1-5]\.\d)\s*\((\d[\d,]*)\)", text)
    rating = float(pair.group(1)) if pair else next((float(l) for l in lines if re.fullmatch(r"[1-5]\.\d", l)), None)
    reviews = re.search(r"\((\d[\d,]*)\)", text)
    category = None
    for l in lines:
        if "·" in l and not re.match(r"(?:open|closed|closes|opens)", l, re.I):
            category = l.split("·")[0].strip() or None
            break
    phone = re.search(r"\+?1?[\s-]?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}", text)
    hours = next((l for l in lines if re.match(r"(?:open|closed|closes|opens)", l, re.I)), None)
    return {"name": name, "rating": rating, "reviews": int(reviews.group(1).replace(",", "")) if reviews else None,
            "category": category, "phone": phone.group(0).strip() if phone else None,
            "hours": hours.split("·")[0].strip() if hours else None, "sponsored": "Sponsored" in text,
            "has_website": "Website" in text, "book_online": "Book online" in text}


def parse_place_panel(name: str, text: str, url: str) -> dict:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    rating = next((float(l) for l in lines if re.fullmatch(r"[1-5]\.\d", l)), None)
    reviews = re.search(r"[1-5]\.\d\s*\n?\s*\((\d[\d,]*)\)", text) or re.search(r"(\d[\d,]*) reviews", text)
    photos = re.search(r"(\d[\d,]*)\+? Photos", text)
    snippets = [l.strip('"\u201c\u201d') for l in lines if re.fullmatch(r'["\u201c].{12,200}["\u201d]', l)][:3]
    idx = next((i for i, l in enumerate(lines) if rating is not None and l == f"{rating}"), None)
    category = None
    if idx is not None:
        for l in lines[idx + 1: idx + 4]:
            if not re.match(r"^\(?\d", l) and len(l) < 60:
                category = l.split("·")[0].strip()
                break
    address = next((l for l in lines if re.search(r",\s*[A-Z]{2}\s+\d{5}", l)), None)
    phone = next((l for l in lines if re.fullmatch(r"\+?1?\s?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}", l)), None)
    hours = next((l for l in lines if re.match(r"(?:open|closed|closes|opens)\b", l, re.I)), None)
    website = next((l for l in lines if re.fullmatch(r"(?:www\.)?[a-z0-9-]+(?:\.[a-z]{2,})+(?:/\S*)?", l, re.I)), None)
    coords = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", url)
    return {"name": name, "rating": rating, "reviews": int(reviews.group(1).replace(",", "")) if reviews else None,
            "category": category, "address": address, "phone": phone, "hours": hours.split("·")[0].strip() if hours else None,
            "website": website, "book_online": "Book online" in text,
            "photos": int(photos.group(1).replace(",", "")) if photos else None, "review_snippets": snippets,
            "latitude": float(coords.group(1)) if coords else None, "longitude": float(coords.group(2)) if coords else None,
            "maps_url": url.split("/data=")[0]}


def ring(lat: float, lng: float, radius_km: float, count: int = 8) -> list[tuple[float, float]]:
    out = []
    for i in range(count):
        angle = 2 * math.pi * i / count
        out.append((round(lat + radius_km / 111.32 * math.sin(angle), 6),
                    round(lng + radius_km / (111.32 * math.cos(math.radians(lat))) * math.cos(angle), 6)))
    return out


def _chrome() -> str | None:
    from .unlighthouse import discover_chrome
    return discover_chrome() or shutil.which("chromium")


async def _maps_session(business: dict[str, str], search_term: str, grid_km: float | None, deadline_s: float) -> dict:
    from playwright.async_api import async_playwright  # type: ignore[import-not-found]
    out: dict = {"place": None, "pack": [], "grid": [], "errors": [], "urls": []}
    started = time.monotonic()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path=_chrome(),
                                          args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = await browser.new_context(locale="en-US", user_agent=_UA, viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        async def load(url: str) -> None:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            for label in ("Accept all", "I agree", "Reject all"):
                button = page.get_by_role("button", name=label, exact=True)
                if await button.count():
                    await button.first.click(timeout=2000)
                    break
            try:
                await page.wait_for_function(
                    "() => location.href.includes('/maps/place/') || document.querySelector('a.hfpxzc')", timeout=9000)
            except Exception:
                pass
            await page.wait_for_timeout(2000)
            out["urls"].append(url)

        async def cards() -> list[dict]:
            raw = await page.evaluate(_CARDS_JS)
            return [parse_card(r["name"], r["text"]) for r in raw if r.get("name")]

        # 1. The business's own listing.
        name, city, state = business["name"], business["city"], business["state"]
        await load("https://www.google.com/maps/search/" + quote_plus(f"{name} {city} {state}") + "?hl=en")
        if "/maps/place/" not in page.url:
            listed = await cards()
            best = max(listed, key=lambda c: similar(name, c["name"]), default=None)
            if best and similar(name, best["name"]) >= 0.6:
                await page.locator("a.hfpxzc").filter(has_text="").and_(
                    page.get_by_label(best["name"], exact=True)).first.click(timeout=5000)
                await page.wait_for_timeout(3500)
        if "/maps/place/" in page.url:
            await page.wait_for_timeout(1500)
            title = await page.locator("h1").first.inner_text(timeout=5000) if await page.locator("h1").count() else ""
            if similar(name, title) >= 0.6:
                main = page.locator("div[role=main]").first
                panel = await main.inner_text(timeout=5000) if await main.count() else await page.inner_text("body")
                out["place"] = parse_place_panel(title, panel, unquote(page.url))
            else:
                out["errors"].append(f"Maps opened a different business ({title[:60]!r})")
        else:
            out["errors"].append("no confirmed Google listing for this name and city")

        # 2. The local results a customer sees for the service in that city.
        place = out["place"] or {}
        lat, lng = place.get("latitude"), place.get("longitude")
        center = f"/@{lat},{lng},13z" if lat is not None else ""
        await load("https://www.google.com/maps/search/" + quote_plus(f"{search_term} {city} {state}") + center + "?hl=en")
        out["pack"] = (await cards())[:20]

        # 3. Full audit: the same search from points around the business (local ranking grid).
        if grid_km and lat is not None:
            for plat, plng in [(lat, lng), *ring(lat, lng, grid_km)]:
                if time.monotonic() - started > deadline_s:
                    out["errors"].append("ranking grid stopped early to stay inside the time budget")
                    break
                await load("https://www.google.com/maps/search/" + quote_plus(search_term) + f"/@{plat},{plng},14z?hl=en")
                results = [c for c in await cards() if not c["sponsored"]][:20]
                rank = next((i + 1 for i, c in enumerate(results) if similar(name, c["name"]) >= 0.6), None)
                out["grid"].append({"lat": plat, "lng": plng, "rank": rank, "of": len(results)})
        await browser.close()
    return out


def listing_check(business: dict[str, str], mode: str = "free", session=None, deadline_s: float = 100) -> CheckResult:
    """Google listing, local results and (full audit) a ranking grid, read from public Google Maps."""
    started = time.monotonic()
    term = business.get("search_term") or business["industry"]
    try:
        raw = session(business, term) if session else asyncio.run(
            _maps_session(business, term, 4.0 if mode == "full" else None, deadline_s))
    except Exception as exc:  # browser missing, Google blocked us, timeout
        return CheckResult("couldnt_check", reason=f"Google Maps could not be read ({type(exc).__name__})",
                           tool="Google Maps (public listing)", observed_at=now_iso())
    ms = round((time.monotonic() - started) * 1000)
    place = raw.get("place")
    organic = [c for c in raw.get("pack", []) if not c.get("sponsored")]
    rank = next((i + 1 for i, c in enumerate(organic) if similar(business["name"], c["name"]) >= 0.6), None)
    competitors = [c for c in organic if similar(business["name"], c["name"]) < 0.6][:5]
    rated = [c["rating"] for c in organic[:10] if c.get("rating") is not None]
    if not place and not organic:
        return CheckResult("couldnt_check", data={"errors": raw.get("errors", [])},
                           reason="; ".join(raw.get("errors", [])) or "Google Maps showed nothing we could read",
                           ms=ms, tool="Google Maps (public listing)", sources=tuple(raw.get("urls", [])), observed_at=now_iso())
    grid = raw.get("grid") or []
    found = [g["rank"] for g in grid if g.get("rank")]
    return CheckResult("ok", {
        "listing_found": bool(place),
        "place": place,
        "search_term": f"{term} {business['city']} {business['state']}",
        "local_rank": rank,
        "results_counted": len(organic),
        "top3": rank is not None and rank <= 3,
        "competitors": competitors,
        "market_avg_rating": round(sum(rated) / len(rated), 2) if rated else None,
        "grid": grid,
        "grid_summary": {"points": len(grid), "found": len(found),
                         "top3": sum(1 for r in found if r <= 3),
                         "avg_rank": round(sum(found) / len(found), 1) if found else None} if grid else None,
        "notes": raw.get("errors", []) + ["Google shows a limited view to signed-out visitors, so review counts may be missing."],
    }, ms=ms, tool="Google Maps (public listing)", sources=tuple(raw.get("urls", [])), observed_at=now_iso())
