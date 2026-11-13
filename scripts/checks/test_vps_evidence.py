import copy
import datetime
import json
import tempfile
import unittest
from pathlib import Path

from vps_evidence import load_dev_auth_evidence, load_dev_portal_evidence


class VpsEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads(Path('archive/dev-retired/docs-codex/vps-evidence.json').read_text())
        self.fixture['checks']['0.7']['observed_on'] = datetime.datetime.now(datetime.timezone.utc).date().isoformat()

    def test_accepts_reported_deployed_revision(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'evidence.json'
            path.write_text(json.dumps(self.fixture))
            self.assertEqual(len(load_dev_portal_evidence(path, 'https://dev.kyneticai.com')), 40)

    def test_rejects_wrong_target_status_provenance_date_and_revision(self):
        original = self.fixture
        for field, value in [('url', 'https://portal.kyneticai.com'), ('http_status', 503),
                             ('source', 'local'), ('observed_on', '2000-01-01'),
                             ('observed_on', '2099-01-01'), ('deployed_revision', '0' * 40),
                             ('reported_output', '')]:
            with self.subTest(field=field, value=value), tempfile.TemporaryDirectory() as tmp:
                record = copy.deepcopy(original)
                record['checks']['0.7'][field] = value
                path = Path(tmp) / 'evidence.json'
                path.write_text(json.dumps(record))
                with self.assertRaises(ValueError):
                    load_dev_portal_evidence(path, 'https://dev.kyneticai.com')

    def test_dev_auth_evidence_uses_the_same_assertion(self):
        record = copy.deepcopy(self.fixture)
        record['checks']['1.7']['observed_on'] = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'evidence.json'
            path.write_text(json.dumps(record))
            self.assertEqual(load_dev_auth_evidence(path, 'https://dev.kyneticai.com')[0:2], (307, 403))
            for field, bad in [('admin_http_status', 200), ('admin_http_status', 404), ('admin_http_status', 0),
                               ('follow_redirects', True), ('method', 'POST'), ('url', 'https://portal.kyneticai.com/'),
                               ('request_headers', {'Cookie': 'synthetic-session'}), ('reported_output', '')]:
                with self.subTest(field=field, bad=bad):
                    changed = copy.deepcopy(record)
                    changed['checks']['1.7'][field] = bad
                    path.write_text(json.dumps(changed))
                    with self.assertRaises(ValueError):
                        load_dev_auth_evidence(path, 'https://dev.kyneticai.com')


if __name__ == '__main__':
    unittest.main()
