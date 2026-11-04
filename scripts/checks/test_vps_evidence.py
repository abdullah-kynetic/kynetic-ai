import copy
import datetime
import json
import tempfile
import unittest
from pathlib import Path

from vps_evidence import load_dev_portal_evidence


class VpsEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads(Path('docs/codex/vps-evidence.json').read_text())
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


if __name__ == '__main__':
    unittest.main()
