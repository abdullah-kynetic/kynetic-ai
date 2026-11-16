import os
import tempfile
import unittest
from audit.app import handle_request


class HttpContractTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["AUDIT_SERVICE_API_KEY"] = "contract-secret"

    def payload(self, mode="free", key="contract"):
        return {"mode": mode, "business": {"name": "Synthetic Co", "website": "https://synthetic.test",
                "city": "Austin", "state": "TX", "industry": "contractor"},
                "answers": {} if mode == "operator" else {"q1": "20-50"}, "idempotency_key": key,
                "html": "<title>Synthetic</title><h1>Synthetic</h1>"}

    def test_auth_and_pdf_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(401, handle_request(self.payload(), "bad", directory)[0])
            status, body = handle_request(self.payload(), "contract-secret", directory)
            self.assertEqual(200, status)
            self.assertTrue(os.path.exists(os.path.join(directory, body["pdf_url"].split("/")[-1])))

    def test_idempotency_returns_same_run(self):
        with tempfile.TemporaryDirectory() as directory:
            first = handle_request(self.payload(key="repeat"), "contract-secret", directory)[1]
            second = handle_request(self.payload(key="repeat"), "contract-secret", directory)[1]
            self.assertEqual(first["run_id"], second["run_id"])

    def test_operator_has_no_question_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            body = handle_request(self.payload("operator", "operator"), "contract-secret", directory)[1]
            self.assertFalse(any(item["evidence"] for item in body["problems"]))

