"""Retired DEV runtime repair must refuse before any SSH."""
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]


class FixRuntimeHandoffTests(unittest.TestCase):
    def test_refuses_without_claiming_success(self):
        result = subprocess.run(
            ['bash', 'scripts/fix-dev-runtime.sh'],
            cwd=ROOT,
            env={'PATH': os.environ['PATH']},
            capture_output=True,
            text=True,
            timeout=30,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('retired', result.stderr)
        self.assertNotIn('PASS DEV_SIGNED_RUNTIME', result.stdout)


if __name__ == '__main__':
    unittest.main()
