"""Parse one HTML page into the facts the SEO, conversion and trust checks read."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser


@dataclass
class PageFacts:
    title: str = ""
    meta_description: str | None = None
    h1: list[str] = field(default_factory=list)
    h2_count: int = 0
    canonical: str | None = None
    viewport: bool = False
    noindex: bool = False
    og: dict[str, str] = field(default_factory=dict)
    jsonld_types: list[str] = field(default_factory=list)
    jsonld: list[dict] = field(default_factory=list)
    images: int = 0
    images_missing_alt: int = 0
    text: str = ""
    forms: list[dict] = field(default_factory=list)
    scripts: list[str] = field(default_factory=list)
    iframes: list[str] = field(default_factory=list)
    lang: str | None = None

    @property
    def word_count(self) -> int:
        return len(re.findall(r"[A-Za-z]{2,}", self.text))


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.f = PageFacts()
        self._stack: list[str] = []
        self._capture: str | None = None
        self._buf: list[str] = []
        self._ignored = 0
        self._jsonld = False
        self._jsonbuf: list[str] = []
        self._text: list[str] = []
        self._form: dict | None = None

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag == "html":
            self.f.lang = a.get("lang") or None
        elif tag == "title":
            self._capture, self._buf = "title", []
        elif tag == "h1":
            self._capture, self._buf = "h1", []
        elif tag == "h2":
            self.f.h2_count += 1
        elif tag == "meta":
            name = (a.get("name") or "").lower()
            prop = (a.get("property") or "").lower()
            content = a.get("content", "")
            if name == "description":
                self.f.meta_description = content.strip()
            elif name == "viewport":
                self.f.viewport = True
            elif name == "robots" and "noindex" in content.lower():
                self.f.noindex = True
            if prop.startswith("og:"):
                self.f.og[prop] = content
        elif tag == "link" and "canonical" in (a.get("rel") or "").lower():
            self.f.canonical = a.get("href") or None
        elif tag == "img":
            self.f.images += 1
            if not a.get("alt", "").strip():
                self.f.images_missing_alt += 1
        elif tag == "script":
            self._ignored += 1
            if (a.get("type") or "").lower() == "application/ld+json":
                self._jsonld, self._jsonbuf = True, []
            if a.get("src"):
                self.f.scripts.append(a["src"])
        elif tag in ("style", "noscript", "svg"):
            self._ignored += 1
        elif tag == "iframe" and a.get("src"):
            self.f.iframes.append(a["src"])
        elif tag == "form":
            self._form = {"action": a.get("action", ""), "fields": []}
        elif tag in ("input", "textarea", "select") and self._form is not None:
            kind = (a.get("type") or tag).lower()
            if kind not in ("hidden", "submit", "button"):
                self._form["fields"].append(((a.get("name") or "") + " " + kind + " " + (a.get("placeholder") or "")).lower())

    def handle_endtag(self, tag):
        if tag == "title" and self._capture == "title":
            self.f.title = " ".join("".join(self._buf).split())
            self._capture = None
        elif tag == "h1" and self._capture == "h1":
            self.f.h1.append(" ".join("".join(self._buf).split()))
            self._capture = None
        elif tag == "script":
            if self._jsonld:
                self._jsonld = False
                self._add_jsonld("".join(self._jsonbuf))
            self._ignored = max(0, self._ignored - 1)
        elif tag in ("style", "noscript", "svg"):
            self._ignored = max(0, self._ignored - 1)
        elif tag == "form" and self._form is not None:
            self.f.forms.append(self._form)
            self._form = None

    def handle_data(self, data):
        if self._jsonld:
            self._jsonbuf.append(data)
            return
        if self._capture:
            self._buf.append(data)
        if not self._ignored:
            self._text.append(data)

    def _add_jsonld(self, raw: str) -> None:
        try:
            payload = json.loads(raw.strip())
        except (ValueError, TypeError):
            return
        stack = payload if isinstance(payload, list) else [payload]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
                continue
            if not isinstance(node, dict):
                continue
            if "@graph" in node:
                stack.extend(node["@graph"] if isinstance(node["@graph"], list) else [node["@graph"]])
            kind = node.get("@type")
            for k in (kind if isinstance(kind, list) else [kind]):
                if isinstance(k, str):
                    self.f.jsonld_types.append(k)
            if kind:
                self.f.jsonld.append(node)


def parse_page(html: str) -> PageFacts:
    parser = _Parser()
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        pass
    parser.f.text = " ".join(" ".join(parser._text).split())
    return parser.f


PHONE_RE = re.compile(r"(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b")


def phones_in(text: str) -> list[str]:
    seen: list[str] = []
    for m in PHONE_RE.finditer(text):
        digits = "".join(m.groups())
        if digits not in seen:
            seen.append(digits)
    return seen


def digits_only(value: str) -> str:
    d = re.sub(r"\D", "", value or "")
    return d[1:] if len(d) == 11 and d.startswith("1") else d
