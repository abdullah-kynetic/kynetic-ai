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
    searchable = f"{text} {aria}"
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


async def fetch_public_maps_html(query: str, timeout_ms: int = 15_000) -> str:
    """Load public Maps search, accepting consent and falling back to the local search form."""
    try:
        from playwright.async_api import async_playwright
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            page = await browser.new_page(extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
            })
            deadline = time.monotonic() + timeout_ms / 1000
            urls = (
                "https://www.google.com/maps/search/?api=1&query=" + quote_plus(query),
                "https://www.google.com/maps/search/" + quote_plus(query),
            )
            html = ""
            for url in urls:
                remaining = max(1000, int((deadline - time.monotonic()) * 1000))
                await page.goto(url, wait_until="domcontentloaded", timeout=remaining)
                for consent in ("Accept all", "I agree", "接受全部"):
                    button = page.get_by_role("button", name=consent, exact=True)
                    if await button.count():
                        await button.first.click(timeout=1000)
                        break
                await page.wait_for_timeout(min(1200, max(100, int((deadline - time.monotonic()) * 1000))))
                html = await page.content()
                if re.search(r"(?:stars?|reviews|ratings)", html, re.I):
                    break
            await browser.close()
            return html
    except Exception:
        return ""


def fetch_public_maps(query: str, business_name: str | None = None) -> CheckResult:
    html = asyncio.run(fetch_public_maps_html(query))
    return parse_maps_page(html, business_name)

