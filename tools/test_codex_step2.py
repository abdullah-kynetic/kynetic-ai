import contextlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

import codex_step2 as provision


class Step2ProvisioningTests(unittest.TestCase):
    def test_default_is_read_only_plan(self):
        with patch.object(sys, 'argv', ['codex_step2.py']), patch.object(provision, 'api') as api, contextlib.redirect_stdout(io.StringIO()):
            provision.main()
        api.assert_not_called()

    def test_repeat_apply_creates_resources_once_and_never_calls_or_activates(self):
        writes = []
        counts = {'agents': 0, 'workflows': 0, 'numbers': 0, 'imports': 0}
        phone = '+' + ''.join(['1', '555', '555', '0101'])
        def api(base, path, headers, method='GET', data=None, form=False):
            if method != 'GET': writes.append((base, path, method))
            if path == '/v1/convai/agents/' + provision.LIVE:
                return {'name': 'Live unchanged', 'conversation_config': {'stable': True}}
            if path == '/v1/convai/agents/create':
                counts['agents'] += 1
                self.assertTrue(data['name'].startswith('DEV-'))
                return {'agent_id': 'agent_dev_fixture'}
            if path == '/v1/convai/agents/agent_dev_fixture': return {'name': 'DEV-fixture'}
            if path == '/workflows?limit=100': return {'data': []}
            if path == '/workflows':
                counts['workflows'] += 1
                self.assertTrue(data['name'].startswith('DEV -'))
                return {'id': 'workflow_dev_fixture'}
            if path == '/tags?limit=100': return {'data': [{'id': 'tag_dev', 'name': 'DEV'}]}
            if path == '/workflows/workflow_dev_fixture/tags': return [{'id': 'tag_dev', 'name': 'DEV'}]
            if path == '/workflows/workflow_dev_fixture': return {'name': 'DEV - fixture', 'active': False}
            if path.startswith('/AvailablePhoneNumbers/'): return {'available_phone_numbers': [{'phone_number': phone}]}
            if path == '/IncomingPhoneNumbers.json':
                counts['numbers'] += 1
                return {'sid': 'PN_dev_fixture'}
            if path == '/IncomingPhoneNumbers/PN_dev_fixture.json':
                return {'friendly_name': 'DEV - fixture', 'phone_number': phone}
            if path == '/v1/convai/phone-numbers' and method == 'POST':
                counts['imports'] += 1
                self.assertEqual(data['agent_id'], 'agent_dev_fixture')
                self.assertFalse(data['enable_sms'])
                self.assertFalse(data['supports_inbound'])
                return {'phone_number_id': 'phone_dev_fixture'}
            if path == '/v1/convai/phone-numbers/phone_dev_fixture': return {'assigned_agent': {'agent_id': 'agent_dev_fixture'}}
            self.fail('Unexpected API route: ' + path)
        env = {name: 'synthetic-fixture' for name in ['ELEVENLABS_API_KEY_blitz', 'n8n_vps', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TEST_PHONE']}
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / 'resources.json'
            state.write_text('{}')
            with patch.object(sys, 'argv', ['codex_step2.py', '--apply']), patch.object(provision, 'STATE', state), patch.object(provision, 'api', api), patch.dict(os.environ, env, clear=True), contextlib.redirect_stdout(io.StringIO()):
                provision.main()
                provision.main()
            self.assertTrue(json.loads(state.read_text())['step2']['live_config_unchanged'])
        self.assertEqual(counts, {'agents': 1, 'workflows': 1, 'numbers': 1, 'imports': 1})
        self.assertFalse(any('/Calls' in path or '/Messages' in path or '/activate' in path for _, path, _ in writes))
        self.assertFalse(any(provision.LIVE in path for _, path, _ in writes))


if __name__ == '__main__':
    unittest.main()
