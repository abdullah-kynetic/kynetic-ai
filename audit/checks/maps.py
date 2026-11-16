import re
import asyncio
from urllib.parse import quote_plus
from html.parser import HTMLParser
from ..models import CheckResult


class _MapsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.text: list[str] = []

    def handle_data(self, data: str) -> None:
        self.text.append(data.strip())


def parse_maps_page(html: str) -> CheckResult:
    lowered = html.lower()
    if any(x in lowered for x in ("captcha", "unusual traffic", "access denied", "sorry")):
        return CheckResult("couldnt_check", reason="blocked")
    parser = _MapsParser()
    parser.feed(html)
    text = " ".join(parser.text)
    rating = re.search(r"(?:rating|rated)[^0-9]*([0-5](?:\.[0-9])?)", text, re.I)
    reviews = re.search(r"([0-9][0-9,]*)\s*(?:reviews|ratings)", text, re.I)
    dates = re.findall(r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}", text, re.I)
    competitors = re.findall(r"(?:competitor|nearby)[:\s]+([A-Z][A-Za-z0-9 &'-]{2,60})", text)
    if not rating or not reviews:
        return CheckResult("couldnt_check", reason="Maps result did not contain rating and review count")
    category = re.search(r"(?:category|type)[:\s]+([^|<]{2,80})", text, re.I)
    return CheckResult("ok", {"rating": float(rating.group(1)),
        "review_count": int(reviews.group(1).replace(",", "")),
        "category": category.group(1).strip() if category else None,
        "latest_review_date": dates[-1] if dates else None,
        "owner_replies": len(re.findall(r"owner reply|response from the owner", text, re.I)),
        "top_competitors": competitors[:3]})


async def fetch_public_maps_html(query: str, timeout_ms: int = 15_000) -> str:
    """One Playwright attempt against the public result page; callers parse the returned HTML."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            page = await browser.new_page(extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
            })
            await page.goto(f"https://www.google.com/maps/search/{quote_plus(query)}", wait_until="domcontentloaded", timeout=timeout_ms)
            html = await page.content()
            await browser.close()
            return html
    except Exception:
        return ""


def fetch_public_maps(query: str) -> CheckResult:
    html = asyncio.run(fetch_public_maps_html(query))
    return parse_maps_page(html or "captcha")

