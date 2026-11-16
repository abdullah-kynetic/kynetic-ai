import re
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
        return CheckResult("couldnt_check")
    parser = _MapsParser()
    parser.feed(html)
    text = " ".join(parser.text)
    rating = re.search(r"(?:rating|rated)[^0-9]*([0-5](?:\.[0-9])?)", text, re.I)
    reviews = re.search(r"([0-9][0-9,]*)\s*(?:reviews|ratings)", text, re.I)
    dates = re.findall(r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}", text, re.I)
    competitors = re.findall(r"(?:competitor|nearby)[:\s]+([A-Z][A-Za-z0-9 &'-]{2,60})", text)
    if not rating or not reviews:
        return CheckResult("couldnt_check")
    return CheckResult("ok", {"rating": float(rating.group(1)),
        "review_count": int(reviews.group(1).replace(",", "")),
        "latest_review_date": dates[-1] if dates else None,
        "owner_replies": len(re.findall(r"owner reply|response from the owner", text, re.I)),
        "top_competitors": competitors[:3]})

