import copy
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4
import codex_step3_twenty as tool


class TwentyWritebackTests(unittest.TestCase):
    def setUp(self):
        self.plan = json.loads(tool.PLAN.read_text())
        self.writes = []
        self.records = {}

    def api(self, method, path, body=None):
        collection = path.split('/')[2]
        if method == 'GET':
            return {'data': {'get' + tool.COLLECTIONS[collection]: self.records[path]}}
        self.writes.append((method, path, body))
        record = {**body, 'id': str(uuid4()) if method == 'POST' else path.split('/')[-1]}
        self.records['/rest/' + collection + '/' + record['id']] = record
        return {'data': {('create' if method == 'POST' else 'update') + tool.COLLECTIONS[collection]: record}}

    def test_default_is_exact_review_plan_with_no_requests(self):
        with patch.object(sys, 'argv', ['codex_step3_twenty.py']), patch.object(tool, 'request') as request, contextlib.redirect_stdout(io.StringIO()) as output:
            tool.main()
        request.assert_not_called()
        self.assertIn(tool.plan_hash(self.plan), output.getvalue())

    def test_apply_is_idempotent_after_completed_journal(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            state = tool.apply_plan(self.plan, tool.plan_hash(self.plan), path, self.api)
            self.assertEqual(state['completed'], [0, 1, 2, 3])
            self.assertEqual([w[0] for w in self.writes], ['POST', 'POST', 'POST', 'PATCH'])
            new_lead = state['created']['endCustomer']
            self.assertEqual(self.writes[3][1], '/rest/endCustomers/' + new_lead)
            tool.apply_plan(self.plan, tool.plan_hash(self.plan), path, self.api)
            self.assertEqual(len(self.writes), 4)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_timeout_leaves_pending_and_refuses_automatic_repeat(self):
        def timeout(*args):
            raise RuntimeError('Synthetic uncertain response')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            with self.assertRaisesRegex(RuntimeError, 'uncertain response'):
                tool.apply_plan(self.plan, tool.plan_hash(self.plan), path, timeout)
            self.assertEqual(json.loads(path.read_text())['pending'], 0)
            with self.assertRaisesRegex(RuntimeError, 'Uncertain previous operation'):
                tool.apply_plan(self.plan, tool.plan_hash(self.plan), path, self.api)
        self.assertEqual(self.writes, [])

    def test_plan_tampering_or_missing_approval_never_writes(self):
        variants = []
        for change in ['DELETE', 'existing_relation', 'phone', 'live_name']:
            plan = copy.deepcopy(self.plan)
            if change == 'DELETE': plan['operations'][3]['method'] = 'DELETE'
            if change == 'existing_relation': plan['operations'][1]['body']['clientAccountId'] = str(uuid4())
            if change == 'phone': plan['operations'][1]['body']['phones'] = {'number': 'untrusted'}
            if change == 'live_name': plan['operations'][0]['body']['name'] = 'Kynetic Restoration (Demo)'
            variants.append(plan)
        with tempfile.TemporaryDirectory() as directory:
            for plan in variants:
                with self.assertRaises(RuntimeError):
                    tool.apply_plan(plan, tool.plan_hash(plan), Path(directory) / 'state.json', self.api)
            with self.assertRaisesRegex(RuntimeError, 'Approval hash'):
                tool.apply_plan(self.plan, None, Path(directory) / 'state.json', self.api)
        self.assertEqual(self.writes, [])

    def test_parent_name_or_account_mismatch_stops_before_write(self):
        for field in ['name', 'clientAccountId']:
            self.writes = []
            self.records = {}
            def api(method, path, body=None):
                if method == 'GET' and '/endCustomers/' in path:
                    response = self.api(method, path, body)
                    response['data']['getEndCustomer'][field] = 'unowned-record'
                    return response
                return self.api(method, path, body)
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaisesRegex(RuntimeError, 'DEV|ownership'):
                    tool.apply_plan(self.plan, tool.plan_hash(self.plan), Path(directory) / 'state.json', api)
            self.assertEqual([w[0] for w in self.writes], ['POST', 'POST'])

    def test_invalid_create_response_is_not_repeated(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'state.json'
            with self.assertRaisesRegex(RuntimeError, 'response shape'):
                tool.apply_plan(self.plan, tool.plan_hash(self.plan), path, lambda *args: {'data': {}})
            self.assertEqual(json.loads(path.read_text())['pending'], 0)

    def test_singular_response_shape_and_request_allowlist(self):
        record_id = str(uuid4())
        self.assertEqual(tool.unwrap({'data': {'endCustomer': {'id': record_id}}}, 'endCustomers', 'get')['id'], record_id)
        for method, path in [('DELETE', '/rest/companies'), ('POST', '/api/calls'), ('GET', '//evil.invalid')]:
            with self.assertRaisesRegex(RuntimeError, 'Disallowed'):
                tool.request(method, path)


if __name__ == '__main__':
    unittest.main()
