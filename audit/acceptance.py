"""Synthetic local acceptance flow; no email, n8n, portal, or live provider is called."""
import json
import os
from pathlib import Path
from .app import handle_request


def run(output: str | Path = "audit/samples") -> list[dict]:
    directory = Path(output)
    directory.mkdir(parents=True, exist_ok=True)
    os.environ["AUDIT_SERVICE_API_KEY"] = "local-acceptance-only"
    records = []
    for index in range(10):
        payload = {"mode": "operator", "business": {"name": f"Synthetic Operator {index + 1}",
            "website": f"https://synthetic-{index + 1}.test", "city": "Austin", "state": "TX",
            "industry": "local services"}, "idempotency_key": f"operator-{index + 1}",
            "html": "<title>Synthetic</title><h1>Synthetic</h1>"}
        status, result = handle_request(payload, "local-acceptance-only", directory)
        assert status == 200 and result["pdf_url"]
        pdf = directory / result["pdf_url"].rsplit("/", 1)[1]
        assert pdf.exists()
        records.append({"business": payload["business"]["name"], "pdf": str(pdf),
                        "section_scores": result["section_scores"], "finding": result["findings"][0],
                        "cost_cents": result["cost_cents"]})
    (directory / "operator-runs.json").write_text(json.dumps(records, indent=2) + "\n")
    return records


if __name__ == "__main__":
    print(json.dumps(run(), indent=2))

