"""Retired DEV deploy scripts must refuse before any SSH or HTTP."""
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]


class DevDeployHandoffTests(unittest.TestCase):
    def test_deploy_scripts_refuse_without_claiming_success(self):
        for script in ['scripts/deploy-dev.sh', 'scripts/step3-dev-handoff.sh', 'scripts/deploy-dev-server.sh']:
            with self.subTest(script=script):
                result = subprocess.run(['bash', script], cwd=ROOT, env={'PATH': os.environ['PATH']}, capture_output=True, text=True, timeout=30)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('retired', result.stderr)
                self.assertNotIn('PASS', result.stdout)
                self.assertNotIn('DEPLOYED_REVISION=', result.stdout)


if __name__ == '__main__':
    unittest.main()
