import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('dev_runtime_config', Path(__file__).resolve().parents[1] / 'dev-runtime/config.py')
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


class DevRuntimeConfigTests(unittest.TestCase):
    def test_private_phone_is_only_in_env_and_worker_has_no_sender_entrypoint(self):
        phone = '+' + ''.join(['1', '555', '555', '0101'])
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'TEST_PHONE': phone}):
            state = Path(folder)
            source = 'APP_BASE_URL=https://dev.kyneticai.com\nAPP_PW=synthetic-private-value\n'
            (state / 'dev.env').write_text(source)
            config = tool.configure(state)
            self.assertEqual((state / 'dev.env').read_text(), source + 'TEST_PHONE=' + phone + '\n')
            self.assertEqual((state / 'dev.env').stat().st_mode & 0o777, 0o600)
            self.assertNotIn(phone, json.dumps(config))
            worker = config['services']['worker']
            self.assertEqual(worker['build']['target'], 'tools')
            self.assertEqual(worker['entrypoint'], ['bun', '/app/src/server/leads/dev-runtime-worker.ts'])
            self.assertEqual(worker['user'], '1001:1001')
            for service in ['app', 'worker', 'runtime-smoke']:
                env = config['services'][service]['environment']
                self.assertEqual(env['PROVIDER_MODE'], 'stub')
                self.assertEqual(env['OUTBOUND_ENABLED'], 'false')
                self.assertEqual(env['ELEVENLABS_LIVE_ENABLED'], 'false')
            self.assertEqual(config['services']['runtime-smoke']['extends'], {'file': str(tool.DEFAULT_COMPOSE), 'service': 'verify-step3'})
            tool.configure(state)
            self.assertEqual((state / 'dev.env').read_text().count('TEST_PHONE='), 1)

    def test_invalid_phone_or_nondev_file_is_not_modified(self):
        for phone, url in [('invalid', 'https://dev.kyneticai.com'), ('+' + ''.join(['1','555','555','0101']), 'https://portal.kyneticai.com')]:
            with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'TEST_PHONE': phone}):
                state = Path(folder)
                original = 'APP_BASE_URL=' + url + '\n'
                (state / 'dev.env').write_text(original)
                with self.assertRaises(RuntimeError): tool.configure(state)
                self.assertEqual((state / 'dev.env').read_text(), original)
                self.assertFalse((state / 'runtime-override.json').exists())


if __name__ == '__main__':
    unittest.main()
