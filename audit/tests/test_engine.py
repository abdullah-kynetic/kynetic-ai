import unittest
import json
from pathlib import Path
from audit.config import BUSINESS_TYPES, require_free_model
from audit.checks import fetch_pagespeed, parse_maps_page
from audit.geogrid import grid_points
from audit.service import parse_request, run

HTML = '<html><head><title>Acme</title></head><body><h1>Acme</h1><a href="tel:1">Call us</a></body></html>'


class AuditTests(unittest.TestCase):
    fixture_dir = Path(__file__).parent / "fixtures"
    def payload(self, mode="free"):
        return {"mode": mode, "business": {"name": "Acme", "website": "https://acme.test",
            "city": "Austin", "state": "TX", "industry": "contractor"},
            "answers": {} if mode == "operator" else {"q1": "150+", "q3": "not sure"},
            "idempotency_key": "test-key" + mode}

    def test_deterministic_scoring(self):
        self.assertEqual(run(self.payload(), "secret", "secret", HTML), run(self.payload(), "secret", "secret", HTML))

    def test_operator_does_not_infer_answers(self):
        result = run(self.payload("operator"), "secret", "secret", HTML)
        self.assertEqual([], [p for p in result["problems"] if p["evidence"]])

    def test_rejects_disallowed_state_and_hipaa(self):
        with self.assertRaises(ValueError): parse_request({**self.payload(), "business": {**self.payload()["business"], "state": "FL"}})
        with self.assertRaises(ValueError): parse_request({**self.payload(), "business": {**self.payload()["business"], "industry": "HIPAA clinic"}})

    def test_auth_and_phantomreach_boundary(self):
        with self.assertRaises(PermissionError): run(self.payload(), "bad", "secret", HTML)
        self.assertNotIn("phantom", run(self.payload(), "secret", "secret", HTML))

    def test_fixture_blocked_page(self):
        payload = {**self.payload(), "idempotency_key": "blocked-fixture"}
        result = run(payload, "secret", "secret", "<html><title>captcha</title></html>")
        self.assertEqual("couldnt_check", result["checks"]["seo"]["status"])

    def test_eight_business_types_and_free_model_policy(self):
        self.assertEqual(8, len(BUSINESS_TYPES))
        self.assertEqual("model:free", require_free_model("model:free"))
        with self.assertRaises(ValueError): require_free_model("model:paid")

    def test_pagespeed_mocked_client(self):
        fixture = (self.fixture_dir / "pagespeed.json").read_bytes()
        result = fetch_pagespeed("https://acme.test", "test-key", lambda _: fixture)
        self.assertEqual("ok", result.status)
        self.assertEqual(83, result.data["performance_score"])

    def test_maps_fixture_and_captcha(self):
        result = parse_maps_page((self.fixture_dir / "maps.html").read_text(), "Acme")
        self.assertEqual(123, result.data["review_count"])
        self.assertEqual(1, result.data["owner_replies"])
        self.assertEqual("couldnt_check", parse_maps_page((self.fixture_dir / "maps-captcha.html").read_text(), "Acme").status)

    def test_geogrid_is_bounded_and_deterministic(self):
        points = grid_points(30.2672, -97.7431, count=9)
        self.assertEqual(9, len(points))
        self.assertEqual(points, grid_points(30.2672, -97.7431, count=9))


if __name__ == "__main__": unittest.main()

