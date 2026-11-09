"""Offline tests for check 3.4 env handling. No network, no real credentials."""
import unittest
from unittest.mock import patch
import checks


class TwentyCheckTests(unittest.TestCase):
    def test_uses_supported_names_only(self):
        env = {"TWENTY_BASE_URL": "https://twenty.invalid/", "TWENTY_SELFHOST_API_KEY": "fake-token"}
        url, need, headers = checks.twenty_check_args(env)
        self.assertEqual(url, "https://twenty.invalid/rest/companies?limit=1")
        self.assertEqual(need, ["TWENTY_SELFHOST_API_KEY"])
        self.assertEqual(headers, {"Authorization": "Bearer fake-token"})

    def test_dead_name_is_ignored(self):
        _, _, headers = checks.twenty_check_args({"TWENTY_API_KEY": "dead-fake"})
        self.assertEqual(headers, {"Authorization": "Bearer "})

    def test_default_base_url(self):
        url, _, _ = checks.twenty_check_args({})
        self.assertTrue(url.startswith(checks.TWENTY + "/rest/"))

    def test_skips_without_key_and_makes_no_request(self):
        checks.R.update(PASS=0, FAIL=0, SKIP=0)
        with patch.dict("os.environ", {}, clear=True), patch.object(checks, "get") as g:
            url, need, headers = checks.twenty_check_args()
            checks.http_check("3.4", "t", url, need, headers)
        g.assert_not_called()
        self.assertEqual(checks.R["SKIP"], 1)

    def test_dead_name_alone_still_skips(self):
        checks.R.update(PASS=0, FAIL=0, SKIP=0)
        with patch.dict("os.environ", {"TWENTY_API_KEY": "dead-fake"}, clear=True), patch.object(checks, "get") as g:
            url, need, headers = checks.twenty_check_args()
            checks.http_check("3.4", "t", url, need, headers)
        g.assert_not_called()
        self.assertEqual(checks.R["SKIP"], 1)

    def test_key_present_sends_bearer_to_get(self):
        checks.R.update(PASS=0, FAIL=0, SKIP=0)
        with patch.dict("os.environ", {"TWENTY_SELFHOST_API_KEY": "fake"}, clear=True), patch.object(checks, "get", return_value=(200, b"")) as g:
            url, need, headers = checks.twenty_check_args()
            checks.http_check("3.4", "t", url, need, headers)
        g.assert_called_once()
        self.assertEqual(checks.R["PASS"], 1)


if __name__ == "__main__":
    unittest.main()
