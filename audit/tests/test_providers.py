import importlib
import json
import os
import tempfile
import unittest
from pathlib import Path

from audit.checks.ai_mentions import OpenRouterError, check_mentions_with_fallback
from audit.checks.geocode import geocode
from audit.checks.maps import parse_maps_page
from audit.checks.pagespeed import fetch_pagespeed, normalize_target
from audit.checks.unlighthouse import parse_summary, unlighthouse_command
from audit.geogrid import full_audit_grid
from audit.service import run


class ProviderPolicyTests(unittest.TestCase):
    fixtures = Path(__file__).parent / "fixtures"

    def test_pagespeed_encoding_error_reason_and_retry(self):
        self.assertEqual("https://example.test/path/", normalize_target("example.test/path"))
        calls = []
        def transport(url):
            calls.append(url)
            if len(calls) == 1: return 503, b'{"error":{"message":"temporarily unavailable"}}'
            return 400, b'{"error":{"message":"invalid URL"}}'
        result = fetch_pagespeed("example.test/path", "secret-not-printed", transport, sleep=lambda _: None)
        self.assertEqual("couldnt_check", result.status)
        self.assertIn("invalid URL", result.reason or "")
        self.assertEqual(2, len(calls))
        self.assertIn("strategy=mobile", calls[0])
        self.assertEqual(4, calls[0].count("category="))
        self.assertNotIn("secret-not-printed", result.reason or "")

    def test_pagespeed_real_fixtures_parse_100_and_report_missing_category(self):
        perfect = fetch_pagespeed("https://example.test", "fixture-key",
                                  lambda _: (self.fixtures / "pagespeed-100.json").read_bytes())
        self.assertEqual("ok", perfect.status)
        self.assertEqual(100, perfect.data["performance_score"])
        self.assertEqual(100, perfect.data["scores"]["best-practices"])
        incomplete = fetch_pagespeed("https://example.test", "fixture-key",
                                     lambda _: (self.fixtures / "pagespeed-missing-categories.json").read_bytes())
        self.assertEqual("couldnt_check", incomplete.status)
        self.assertIn("ValueError", incomplete.reason or "")
        self.assertIn("missing seo score", incomplete.reason or "")

    def test_ai_fallback_429_then_success_records_model(self):
        calls = []
        def ask(model, prompt):
            calls.append(model)
            if len(calls) == 1: raise OpenRouterError(429)
            return "Synthetic Co is mentioned."
        result = check_mentions_with_fallback({"name":"Synthetic Co", "city":"Austin", "industry":"contractor"},
            ["first:free", "second:free"], ask, sleep=lambda _: None)
        self.assertEqual("ok", result.status)
        self.assertEqual("second:free", result.data["model"])
        self.assertEqual("model recall, not live search", result.data["label"])
        self.assertEqual([{"model": "first:free", "status": 429},
                          {"model": "second:free", "status": 200}], result.data["models_tried"])

    def test_ai_failure_populates_reason_and_models_tried(self):
        result = check_mentions_with_fallback(
            {"name": "Synthetic Co", "city": "Austin", "industry": "contractor"},
            ["broken:free"], lambda *_: (_ for _ in ()).throw(RuntimeError("connection reset")), sleep=lambda _: None)
        self.assertEqual("couldnt_check", result.status)
        self.assertIn("RuntimeError", result.reason or "")
        self.assertEqual([{"model": "broken:free", "status": 0}], result.data["models_tried"])

    def test_nominatim_mocked_and_cached(self):
        calls = []
        def transport(url, headers):
            calls.append((url, headers))
            return b'[{"lat":"30.2672","lon":"-97.7431"}]'
        first = geocode("unique synthetic business Austin", transport, sleep=lambda _: None)
        second = geocode("unique synthetic business Austin", transport, sleep=lambda _: None)
        self.assertEqual("ok", first.status)
        self.assertEqual(first.data, second.data)
        self.assertEqual(1, len(calls))
        self.assertIn("User-Agent", calls[0][1])

    def test_geogrid_fallback_city_is_labeled_and_total_failure_is_couldnt_check(self):
        calls = []
        def city_only(url, headers):
            calls.append(url)
            if "Austin" in url and "Synthetic" not in url and "synthetic.test" not in url:
                return b'[{"lat":"30.2672","lon":"-97.7431"}]'
            return b"[]"
        result = full_audit_grid({"name": "Synthetic", "website": "https://synthetic.test",
                                  "city": "Austin", "state": "TX"}, city_only)
        self.assertEqual("ok", result.status)
        self.assertEqual("estimate; centered on city", result.data["label"])
        self.assertEqual(9, len(result.data["points"]))
        failed = full_audit_grid({"name": "No Place", "website": "https://none.test",
                                  "city": "Nowhere", "state": "ZZ"}, lambda *_: b"[]")
        self.assertEqual("couldnt_check", failed.status)
        self.assertIn("Nominatim", failed.reason or "")

    def test_unlighthouse_fixture_parser(self):
        parsed = parse_summary((self.fixtures / "unlighthouse-summary.json").read_text())
        self.assertEqual(15, parsed["pages"])
        self.assertEqual(0.81, parsed["score"]["performance"])

    def test_unlighthouse_command_is_pinned_and_bounded(self):
        command = unlighthouse_command("https://synthetic.test")
        self.assertIn("unlighthouse@0.15.2", command)
        self.assertEqual("15", command[command.index("--max-routes") + 1])
        self.assertEqual("https://synthetic.test", command[command.index("--site") + 1])

    def test_maps_aria_fixture_parses_rating_and_reviews(self):
        result = parse_maps_page((self.fixtures / "maps-aria.html").read_text())
        self.assertEqual("ok", result.status)
        self.assertEqual(4.8, result.data["rating"])
        self.assertEqual(216, result.data["review_count"])

    def test_maps_failure_includes_debug_context(self):
        result = parse_maps_page('<html><head><title>Consent</title></head><body>Search</body></html>')
        self.assertEqual("couldnt_check", result.status)
        self.assertIn("title='Consent'", result.reason or "")
        self.assertIn("html_length=", result.reason or "")

    def test_public_request_ignores_phantomreach_flag(self):
        payload = {"mode":"operator", "operator_phantomreach":True,
            "business":{"name":"Synthetic","website":"https://synthetic.test","city":"Austin","state":"TX","industry":"contractor"},
            "idempotency_key":"public-phantom-test", "html":"<title>Synthetic</title>"}
        result = run(payload, "key", "key", html=payload["html"], operator_authorized=False)
        self.assertEqual("skipped", result["checks"]["phantomreach"]["status"])

    def test_daily_cap_override_is_startup_only(self):
        import audit.app as app
        previous = os.environ.get("AUDIT_DAILY_CAP_OVERRIDE")
        previous_key = os.environ.get("AUDIT_SERVICE_API_KEY")
        os.environ["AUDIT_SERVICE_API_KEY"] = "key"
        os.environ["AUDIT_DAILY_CAP_OVERRIDE"] = "2"
        app = importlib.reload(app)
        app._runs.clear()
        payload = {"mode":"free", "business":{"name":"Cap Synthetic","website":"https://cap.test","city":"Austin","state":"TX","industry":"contractor"}, "answers":{}, "html":"<title>Cap</title>"}
        with tempfile.TemporaryDirectory() as directory:
            for i in range(2):
                status, _ = app.handle_request({**payload, "idempotency_key":f"cap-{i}"}, "key", directory)
                self.assertEqual(200, status)
            status, _ = app.handle_request({**payload, "idempotency_key":"cap-2"}, "key", directory)
            self.assertEqual(429, status)
        if previous is None: os.environ.pop("AUDIT_DAILY_CAP_OVERRIDE", None)
        else: os.environ["AUDIT_DAILY_CAP_OVERRIDE"] = previous
        if previous_key is None: os.environ.pop("AUDIT_SERVICE_API_KEY", None)
        else: os.environ["AUDIT_SERVICE_API_KEY"] = previous_key
        app = importlib.reload(app)
        self.assertEqual(50, app._DAILY_CAP)

