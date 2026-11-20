"""Read the business website: the home page, the most useful internal pages, robots.txt and the sitemap."""

from __future__ import annotations

import re
import time
import urllib.parse
from collections.abc import Callable
from dataclasses import dataclass, field
from html.parser import HTMLParser

from ..models import CheckResult
from ..net import BlockedTarget, Response, fetch, normalize_url, now_iso

Transport = Callable[[str], Response]

BLOCK_MARKERS = ("captcha", "unusual traffic", "access denied", "attention required", "just a moment...")
# Pages that tell us the most about how a visitor becomes a lead, in priority order.
PRIORITY = ("contact", "estimate", "quote", "book", "schedule", "about", "review", "testimonial", "service",
            "gallery", "portfolio", "project", "financ", "warrant", "area", "faq")
SKIP_EXT = re.compile(r"\.(?:jpe?g|png|gif|webp|svg|pdf|zip|mp4|mov|docx?|xlsx?|css|js|ico)(?:$|\?)", re.I)


class _Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href") or ""
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data.strip())

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join(t for t in self._text if t)))
            self._href = None


@dataclass
class Page:
    url: str
    status: int
    html: str
    ms: int = 0


@dataclass
class Crawl:
    start_url: str
    final_url: str = ""
    pages: list[Page] = field(default_factory=list)
    robots: str | None = None
    sitemap_urls: int | None = None
    sitemap_found: bool = False
    blocked: bool = False
    error: str = ""
    links: list[tuple[str, str]] = field(default_factory=list)

    @property
    def home(self) -> Page | None:
        return self.pages[0] if self.pages else None

    @property
    def all_html(self) -> str:
        return "\n".join(p.html for p in self.pages)


def same_site(url: str, base: str) -> bool:
    a = urllib.parse.urlparse(url).netloc.lower().removeprefix("www.")
    b = urllib.parse.urlparse(base).netloc.lower().removeprefix("www.")
    return a == b


def internal_links(html: str, base: str) -> list[tuple[str, str]]:
    parser = _Links()
    try:
        parser.feed(html)
    except Exception:
        return []
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for href, text in parser.links:
        if not href or href.startswith(("#", "mailto:", "tel:", "sms:", "javascript:")):
            continue
        absolute = urllib.parse.urljoin(base, href).split("#")[0]
        if not same_site(absolute, base) or SKIP_EXT.search(absolute):
            continue
        key = absolute.rstrip("/")
        if key not in seen:
            seen.add(key)
            out.append((absolute, text))
    return out


def all_links(html: str, base: str) -> list[tuple[str, str]]:
    parser = _Links()
    try:
        parser.feed(html)
    except Exception:
        return []
    return [(urllib.parse.urljoin(base, h), t) for h, t in parser.links if h]


def _rank(url: str, text: str) -> int:
    hay = (url + " " + text).lower()
    for index, word in enumerate(PRIORITY):
        if word in hay:
            return index
    return len(PRIORITY)


def crawl_site(website: str, transport: Transport | None = None, max_pages: int = 6) -> Crawl:
    get = transport or (lambda u: fetch(u))
    start = normalize_url(website)
    crawl = Crawl(start)
    try:
        started = time.monotonic()
        home = get(start)
        crawl.final_url = home.url or start
        if home.status >= 400 or not home.body:
            crawl.error = f"home page returned HTTP {home.status}"
            return crawl
        text = home.text
        if any(m in text.lower()[:20000] for m in BLOCK_MARKERS) and len(text) < 60000:
            crawl.blocked = True
            crawl.error = "the site showed a bot challenge"
            return crawl
        crawl.pages.append(Page(crawl.final_url, home.status, text, round((time.monotonic() - started) * 1000)))
    except BlockedTarget as exc:
        crawl.error = str(exc)
        return crawl
    except (OSError, TimeoutError, ValueError) as exc:
        crawl.error = f"home page could not be loaded ({type(exc).__name__})"
        return crawl

    crawl.links = all_links(crawl.pages[0].html, crawl.final_url)
    candidates = sorted(internal_links(crawl.pages[0].html, crawl.final_url), key=lambda lt: _rank(*lt))
    home_key = crawl.final_url.rstrip("/")
    for url, _text in candidates:
        if len(crawl.pages) >= max_pages:
            break
        if url.rstrip("/") == home_key:
            continue
        try:
            started = time.monotonic()
            response = get(url)
            if response.status < 400 and response.body:
                crawl.pages.append(Page(response.url or url, response.status, response.text,
                                        round((time.monotonic() - started) * 1000)))
        except (OSError, TimeoutError, ValueError):
            continue

    root = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(crawl.final_url))
    try:
        robots = get(root + "/robots.txt")
        if robots.status == 200 and "<html" not in robots.text[:500].lower():
            crawl.robots = robots.text[:20000]
    except (OSError, TimeoutError, ValueError):
        pass
    sitemap_url = root + "/sitemap.xml"
    if crawl.robots:
        match = re.search(r"(?im)^\s*sitemap:\s*(\S+)", crawl.robots)
        if match:
            sitemap_url = match.group(1)
    try:
        sitemap = get(sitemap_url)
        if sitemap.status == 200 and ("<urlset" in sitemap.text or "<sitemapindex" in sitemap.text):
            crawl.sitemap_found = True
            crawl.sitemap_urls = sitemap.text.count("<loc>")
    except (OSError, TimeoutError, ValueError):
        pass
    return crawl


def crawl_check(crawl: Crawl) -> CheckResult:
    sources = tuple(p.url for p in crawl.pages)
    if not crawl.pages:
        return CheckResult("couldnt_check", reason=crawl.error or "website could not be read", tool="Website crawler",
                           sources=(crawl.start_url,), observed_at=now_iso())
    home = crawl.pages[0]
    return CheckResult("ok", {
        "pages_read": len(crawl.pages),
        "pages": [{"url": p.url, "status": p.status, "ms": p.ms, "bytes": len(p.html)} for p in crawl.pages],
        "home_ms": home.ms,
        "https": crawl.final_url.startswith("https://"),
        "robots_txt": crawl.robots is not None,
        "sitemap": crawl.sitemap_found,
        "sitemap_urls": crawl.sitemap_urls,
    }, ms=sum(p.ms for p in crawl.pages), tool="Website crawler", sources=sources, observed_at=now_iso())
