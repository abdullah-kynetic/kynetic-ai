"""Mac handoff behavior with local SSH/curl doubles; never contacts a server."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class DevDeployHandoffTests(unittest.TestCase):
    def run_handoff(self, signin, admin):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            ssh = folder / 'ssh'
            ssh.write_text('''#!/usr/bin/env python3
import sys
command = sys.argv[-1]
if 'mktemp -d' in command:
    print('/tmp/kynetic-dev-upload.fixture123')
elif command.startswith('tar '):
    sys.stdin.buffer.read()
elif not command.startswith('sudo bash '):
    raise SystemExit('Unexpected SSH command')
''')
            curl = folder / 'curl'
            curl.write_text('''#!/usr/bin/env python3
import json,os,sys
with open(os.environ['CURL_TEST_LOG'],'a') as f: f.write(json.dumps(sys.argv[1:])+'\\n')
url = sys.argv[-1]
if url not in ['https://dev.kyneticai.com/', 'https://dev.kyneticai.com/sign-in', 'https://dev.kyneticai.com/admin']:
    raise SystemExit('Refusing non-dev request')
if '%{http_code}' in sys.argv:
    print(os.environ['SIGNIN_TEST_STATUS'] if url.endswith('/sign-in') else os.environ['ADMIN_TEST_STATUS'] if url.endswith('/admin') else '200', end='')
''')
            ssh.chmod(0o755)
            curl.chmod(0o755)
            identity = folder / 'synthetic key file'
            identity.write_text('not-a-real-key')
            log = folder / 'curl.log'
            env = {'PATH': str(folder) + ':' + os.environ['PATH'], 'HOME': str(folder),
                   'DEV_DEPLOY_SSH_HOST': 'test.invalid', 'DEV_DEPLOY_SSH_USER': 'ubuntu',
                   'DEV_DEPLOY_SSH_IDENTITY_FILE': str(identity), 'CURL_TEST_LOG': str(log),
                   'SIGNIN_TEST_STATUS': str(signin), 'ADMIN_TEST_STATUS': str(admin)}
            result = subprocess.run(['bash', 'scripts/deploy-dev.sh'], cwd=ROOT, env=env,
                                    capture_output=True, text=True, timeout=30)
            requests = [json.loads(line) for line in log.read_text().splitlines()]
            for args in requests:
                self.assertTrue(args[-1].startswith('https://dev.kyneticai.com/'))
                if args[-1].endswith(('/sign-in', '/admin')):
                    self.assertNotIn('--location', args)
                    self.assertIn('-q', args)
            return result

    def test_new_auth_passes_and_reports_deployed_revision(self):
        result = self.run_handoff(200, 401)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('PASS DEV_AUTH', result.stdout)
        self.assertRegex(result.stdout, r'DEPLOYED_REVISION=[0-9a-f]{40}')

    def test_old_image_redirect_or_public_admin_cannot_pass(self):
        for signin, admin in [(404, 403), (307, 401), (200, 200), (200, 403), (200, 503)]:
            with self.subTest(signin=signin, admin=admin):
                result = self.run_handoff(signin, admin)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('PASS DEV_AUTH', result.stdout)
                self.assertNotIn('DEPLOYED_REVISION=', result.stdout)


if __name__ == '__main__':
    unittest.main()
