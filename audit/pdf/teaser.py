from html import escape


def render_html(business_name: str, score: int, findings: list[str]) -> str:
    rows = "".join(f"<li>{escape(item)}</li>" for item in findings[:3])
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
    body{{font-family:Arial;color:#17202a;padding:42px}}h1{{color:#147d92}}
    .score{{font-size:54px;font-weight:700;color:#147d92}}li{{margin:12px 0}}
    </style></head><body><h1>Kynetic AI — Instant Audit</h1>
    <h2>{escape(business_name)}</h2><div class="score">{score}/100</div>
    <h3>What stood out</h3><ul>{rows}</ul><p>Book your Full Business Audit.</p></body></html>'''

