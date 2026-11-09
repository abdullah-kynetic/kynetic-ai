import contextlib
import io
import sys
import unittest
from unittest.mock import patch

import codex_step2 as provision


class Step2ProvisioningTests(unittest.TestCase):
    def test_default_is_read_only_plan(self):
        with patch.object(sys, 'argv', ['codex_step2.py']), patch.object(provision, 'api') as api, contextlib.redirect_stdout(io.StringIO()):
            provision.main()
        api.assert_not_called()

    def test_apply_is_retired_and_makes_no_request(self):
        with patch.object(sys, 'argv', ['codex_step2.py', '--apply']), patch.object(provision, 'api') as api:
            with self.assertRaises(RuntimeError) as caught:
                provision.main()
        api.assert_not_called()
        self.assertIn('retired', str(caught.exception))


if __name__ == '__main__':
    unittest.main()
