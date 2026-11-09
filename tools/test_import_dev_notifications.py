import contextlib
import copy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import import_dev_notifications as tool


class ImportDevNotificationsTests(unittest.TestCase):
    def setUp(self):
        self.workflows = {kind: json.loads((tool.ROOT / 'n8n/workflows/dev' / (kind + '.json')).read_text()) for kind in tool.KINDS}
        self.remote = {}
        self.writes = []

    def api(self, method, path, data=None):
        if method != 'GET': self.writes.append((method, path))
        if path == '/workflows?limit=100':
            return {'data': [{'id': key, 'name': value['name']} for key, value in self.remote.items()]}
        if path == '/tags?limit=100': return {'data': [{'id': 'dev-tag', 'name': 'DEV'}]}
        if method == 'POST' and path == '/workflows':
            key = 'new-dev-' + str(len(self.remote))
            self.remote[key] = {**copy.deepcopy(data), 'active': False, 'tags': []}
            return {'id': key}
        key = path.split('/')[2]
        if method == 'GET': return copy.deepcopy(self.remote[key])
        if method == 'PUT' and path.endswith('/tags'):
            self.remote[key]['tags'] = [{'id': 'dev-tag', 'name': 'DEV'}]
            return self.remote[key]['tags']
        self.fail('Unexpected request')

    def test_default_makes_no_api_request(self):
        with patch.object(sys, 'argv', ['import_dev_notifications.py']), patch.object(tool, 'request') as api, contextlib.redirect_stdout(io.StringIO()):
            tool.main()
        api.assert_not_called()

    def test_creates_only_four_new_inactive_objects_tags_and_verifies_without_duplicate_writes(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'state.json'
            state = tool.apply(self.workflows, path, self.api)
            self.assertEqual(len(state['workflows']), 4)
            self.assertTrue(all(value['verified_inactive'] for value in state['workflows'].values()))
            self.assertEqual(len(self.writes), 8)
            self.assertEqual(sum(method == 'POST' for method, _ in self.writes), 4)
            tool.apply(self.workflows, path, self.api)
            self.assertEqual(len(self.writes), 8)
            self.assertFalse(any('/activate' in path or '/execut' in path for _, path in self.writes))
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_unowned_name_collision_refuses_all_mutations(self):
        self.remote['existing-dev'] = {'name': 'DEV - reminder'}
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(RuntimeError, 'collision'):
                tool.apply(self.workflows, Path(folder) / 'state.json', self.api)
        self.assertEqual(self.writes, [])

    def test_uncertain_create_is_journaled_and_never_automatically_repeated(self):
        def api(method, path, data=None):
            if method == 'POST': raise RuntimeError('Synthetic timeout')
            return self.api(method, path, data)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'state.json'
            with self.assertRaisesRegex(RuntimeError, 'timeout'):
                tool.apply(self.workflows, path, api)
            self.assertIn('pending', json.loads(path.read_text()))
            with self.assertRaisesRegex(RuntimeError, 'Uncertain'):
                tool.apply(self.workflows, path, self.api)
        self.assertEqual(self.writes, [])

    def test_live_or_credentialed_nodes_are_rejected(self):
        for change in ['active', 'enabled_sms', 'wrong_to', 'credentials']:
            workflow = copy.deepcopy(self.workflows['missed-call'])
            sms = next(node for node in workflow['nodes'] if node['id'] == 'sms-disabled')
            if change == 'active': workflow['active'] = True
            elif change == 'enabled_sms': sms['disabled'] = False
            elif change == 'wrong_to': sms['parameters']['to'] = 'untrusted'
            else: sms['credentials'] = {'twilioApi': {'id': 'existing-credential'}}
            with self.assertRaises(RuntimeError): tool.validate(workflow, workflow['name'])

    def test_api_allowlist_has_no_execution_activation_deletion_or_definition_update(self):
        for method, path in [('POST', '/workflows/id/activate'), ('POST', '/workflows/id/execute'), ('DELETE', '/workflows/id'), ('PUT', '/workflows/id')]:
            with self.assertRaisesRegex(RuntimeError, 'Disallowed'):
                tool.request(method, path)


if __name__ == '__main__':
    unittest.main()
