import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('dev_runtime', Path(__file__).with_name('dev-runtime-server.py'))
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class DevReadinessTests(unittest.TestCase):
    def run_fixture(self, *, phone=False, worker=False, project='kynetic-dev-portal', extras=None):
        calls = []
        def runner(args):
            calls.append(args)
            if args[-1] == 'app': return 'a' * 64
            if args[-1] == 'worker': return 'b' * 64 if worker else ''
            if 'inspect' in args: return project
            if 'exec' in args:
                values = dict.fromkeys(tool.SAFE_ENV_KEYS, True)
                values['test_phone_configured'] = phone
                return json.dumps({**values, **(extras or {})})
            self.fail('Unexpected read command')
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'dev'
            state = Path(folder) / 'state'
            state.mkdir()
            revision = 'a' * 40
            (state / 'deployed-revision').write_text(revision)
            release = root / 'releases' / revision
            release.mkdir(parents=True)
            (root / 'current').symlink_to(release)
            result = tool.readiness(root, state, runner)
        self.assertFalse(any(value in ['up', 'restart', 'run', 'stop', 'start', 'build'] for args in calls for value in args))
        return result

    def test_missing_phone_and_worker_are_reported_without_service_changes(self):
        result = self.run_fixture()
        self.assertEqual(result['blockers'], ['TEST_PHONE_NOT_CONFIGURED_IN_DEV_APP', 'DEV_DISPATCH_WORKER_NOT_RUNNING'])
        self.assertFalse(result['changes_made'])
        self.assertFalse(result['live_test_authorized'])

    def test_ready_environment_still_does_not_authorize_a_live_test(self):
        result = self.run_fixture(phone=True, worker=True)
        self.assertEqual(result['status'], 'READY_FOR_SYNTHETIC_WORKER_VERIFICATION')
        self.assertEqual(result['provider_requests'], 0)
        self.assertFalse(result['live_test_authorized'])

    def test_never_prints_unknown_or_sensitive_environment_values(self):
        result = self.run_fixture(extras={'SECRET': 'synthetic-private-key'})
        self.assertNotIn('synthetic-private-key', json.dumps(result))
        with self.assertRaisesRegex(RuntimeError, 'raw values withheld'):
            self.run_fixture(extras={'test_phone_configured': 'synthetic-private-key'})

    def test_refuses_a_container_from_another_project(self):
        with self.assertRaisesRegex(RuntimeError, 'outside the DEV project'):
            self.run_fixture(project='production')


if __name__ == '__main__':
    unittest.main()
