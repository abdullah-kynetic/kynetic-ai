import unittest
from audit.service import parse_request, run

HTML = '<html><head><title>Acme</title></head><body><h1>Acme</h1><a href="tel:1">Call us</a></body></html>'


class AuditTests(unittest.TestCase):
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


if __name__ == "__main__": unittest.main()

