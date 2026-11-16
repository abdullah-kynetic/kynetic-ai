from html.parser import HTMLParser
from ..models import CheckResult


class _Parser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.meta = False
        self.h1 = 0
        self.schema = False
        self.text = ""
        self.noindex = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "title": self.meta = True
        if tag == "h1": self.h1 += 1
        if tag == "script" and attrs_dict.get("type") == "application/ld+json": self.schema = True
        if tag == "meta" and attrs_dict.get("name", "").lower() == "robots":
            self.noindex = "noindex" in attrs_dict.get("content", "").lower()

    def handle_endtag(self, tag: str) -> None:
        if tag == "title": self.meta = False

    def handle_data(self, data: str) -> None:
        if self.meta: self.title += data.strip()
        self.text += data


def inspect_html(html: str) -> CheckResult:
    if any(marker in html.lower() for marker in ("captcha", "unusual traffic", "access denied")):
        return CheckResult("couldnt_check")
    parser = _Parser()
    try:
        parser.feed(html)
    except Exception:
        return CheckResult("couldnt_check")
    return CheckResult("ok", {"title": parser.title, "h1_count": parser.h1,
        "schema": parser.schema, "indexable": not parser.noindex,
        "has_contact_signal": any(x in parser.text.lower() for x in ("contact", "call us", "book"))})

