import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class FixRuntimeHandoffTests(unittest.TestCase):
    def run_fixture(self, *, user='ubuntu', wrong_branch=False, server_fail=False):
        with tempfile.TemporaryDirectory() as folder:
            repo = Path(folder)
            for relative in ['scripts/fix-dev-runtime.sh', 'scripts/dev-runtime/server.sh', 'scripts/dev-runtime/config.py', 'crm/src/server/leads/dev-runtime-worker.ts', 'crm/src/server/leads/dev-runtime-smoke.ts']:
                target = repo / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, target)
            subprocess.run(['git', 'init', '-q', '-b', 'dev/codex-setup'], cwd=repo, check=True)
            subprocess.run(['git', 'add', '.'], cwd=repo, check=True)
            commit_env = {**os.environ, 'GIT_AUTHOR_NAME': 'abdullah-kynetic', 'GIT_AUTHOR_EMAIL': 'abdullah@kyneticai.com', 'GIT_COMMITTER_NAME': 'abdullah-kynetic', 'GIT_COMMITTER_EMAIL': 'abdullah@kyneticai.com'}
            subprocess.run(['git', 'commit', '-qm', 'Synthetic handoff fixture'], cwd=repo, env=commit_env, check=True)
            if wrong_branch:
                subprocess.run(['git', 'checkout', '-qb', 'wrong-branch'], cwd=repo, check=True)
            # This untracked local file must never be uploaded.
            (repo / '.env').write_text('PRIVATE=synthetic-private-local-value\n')
            bin_dir = repo / 'fake-bin'
            bin_dir.mkdir()
            ssh = bin_dir / 'ssh'
            ssh.write_text('''#!/usr/bin/env python3
import io,os,re,sys,tarfile
command=sys.argv[-1]
if 'mktemp -d /tmp/kynetic-dev-runtime.' in command:
    print('/tmp/kynetic-dev-runtime.fixture')
elif command.startswith('tar '):
    archive=tarfile.open(fileobj=io.BytesIO(sys.stdin.buffer.read()))
    files=[item.name for item in archive.getmembers() if item.isfile()]
    expected={'scripts/dev-runtime/server.sh','scripts/dev-runtime/config.py','crm/src/server/leads/dev-runtime-worker.ts','crm/src/server/leads/dev-runtime-smoke.ts'}
    if set(files)!=expected: raise SystemExit('Unexpected upload contents')
    for item in archive.getmembers():
        if item.isfile() and b'synthetic-private-local-value' in archive.extractfile(item).read(): raise SystemExit('Private env uploaded')
elif command.startswith('sudo bash '):
    if not re.search(r"'[0-9a-f]{40}'$",command): raise SystemExit('Missing helper revision')
    if os.environ.get('SERVER_FAIL')=='1': raise SystemExit(1)
    print('PASS DEV_SIGNED_RUNTIME intake accepted/duplicate; worker processed; kill switch deferred; calls/SMS 0')
else: raise SystemExit('Unexpected SSH command')
''')
            ssh.chmod(0o755)
            key = repo / 'synthetic key'
            key.write_text('not-a-real-key')
            env = {'PATH': str(bin_dir) + ':' + os.environ['PATH'], 'DEV_DEPLOY_SSH_HOST': 'synthetic.invalid', 'DEV_DEPLOY_SSH_USER': user, 'DEV_DEPLOY_SSH_IDENTITY_FILE': str(key), 'SERVER_FAIL': '1' if server_fail else '0'}
            return subprocess.run(['bash', 'scripts/fix-dev-runtime.sh'], cwd=repo, env=env, capture_output=True, text=True, timeout=30)

    def test_uploads_only_committed_secret_free_runtime_files(self):
        result = self.run_fixture()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('PASS DEV_SIGNED_RUNTIME', result.stdout)
        self.assertNotIn('synthetic-private-local-value', result.stdout + result.stderr)

    def test_refuses_wrong_branch_and_restricted_production_login(self):
        for kwargs in [{'wrong_branch': True}, {'user': 'portalnew-deploy'}]:
            result = self.run_fixture(**kwargs)
            self.assertNotEqual(result.returncode, 0)
            self.assertNotIn('PASS DEV_SIGNED_RUNTIME', result.stdout)

    def test_server_failure_cannot_claim_success(self):
        result = self.run_fixture(server_fail=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('PASS DEV_SIGNED_RUNTIME', result.stdout)


if __name__ == '__main__':
    unittest.main()
