"""Offline tests for lead_pipeline.py: no network. Run: python3 -m unittest tools/test_lead_pipeline.py"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import lead_engine as eng  # noqa: E402
import lead_pipeline as lp  # noqa: E402

RUN = HERE.parent / "docs/lead-engine-code-run/remaining-18-2026-10-21/results.json"


def seed(db):
    for i, row in enumerate(json.loads(RUN.read_text())):
        owners = " | ".join(o["name"] for o in row.get("owner_candidates", [])[:2])
        db.execute("INSERT INTO leads(page_id,niche,name,city,state,ads,website,facebook,status,reason,owner,best_phone,phones,"
                   "notes,row_json,enriched_at,called) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (str(1000 + i), "roofing", row["business"], "", row.get("census_state", "TX"), 3, row.get("website", ""),
                    row.get("facebook", ""), row["status"], row.get("reason", ""), owners, row.get("best_phone", ""),
                    json.dumps(row.get("phones", {})), "", json.dumps(row), "2026-10-21T00:00:00Z", ""))
    db.commit()


class T(unittest.TestCase):
    def setUp(self):
        self.db = lp.open_db(tempfile.mktemp(suffix=".db"))
        seed(self.db)

    def test_person_name(self):
        self.assertEqual(lp.person_name("Mr. Billy Ciccolella, MemberMr. Billy Ciccolella, Owner"), "Billy Ciccolella")
        self.assertEqual(lp.person_name("CICCOLELLA MANAGEMENT, LLC"), "")
        self.assertEqual(lp.person_name("Bob"), "")

    def test_audit_only_touches_dial_ready_and_is_deterministic(self):
        before = self.db.execute("SELECT COUNT(*) FROM leads WHERE status='DIAL_READY'").fetchone()[0]
        lp.audit(self.db, NS(dnc_file=None, recheck=False))
        p = self.db.execute("SELECT COUNT(*) FROM leads WHERE audit='PASS'").fetchone()[0]
        f = self.db.execute("SELECT COUNT(*) FROM leads WHERE audit='FAIL'").fetchone()[0]
        self.assertEqual(p + f, before)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM leads WHERE status='HOLD' AND audit='FAIL'").fetchone()[0], f)
        self.assertEqual(lp.uncalled_pass(self.db), p)

    def test_audit_blocks_fl_ok_and_dnc(self):
        lp.audit(self.db, NS(dnc_file=None, recheck=False))
        pid, ph = self.db.execute("SELECT page_id, best_phone FROM leads WHERE audit='PASS'").fetchone()
        self.db.execute("UPDATE leads SET audit='' , status='DIAL_READY' WHERE page_id=?", (pid,))
        f = Path(tempfile.mktemp())
        f.write_text(ph)
        lp.audit(self.db, NS(dnc_file=str(f), recheck=False))
        self.assertIn("do-not-call", self.db.execute("SELECT audit_reason FROM leads WHERE page_id=?", (pid,)).fetchone()[0])
        self.db.execute("UPDATE leads SET audit='', status='DIAL_READY', state='FL', called='' WHERE page_id=?", (pid,))
        lp.audit(self.db, NS(dnc_file=None, recheck=False))
        self.assertIn("FL/OK", self.db.execute("SELECT audit_reason FROM leads WHERE page_id=?", (pid,)).fetchone()[0])

    def test_import_dry_run_dedupes_and_never_writes(self):
        lp.audit(self.db, NS(dnc_file=None, recheck=False))
        pid, ph = self.db.execute("SELECT page_id, best_phone FROM leads WHERE audit='PASS' LIMIT 1").fetchone()
        calls = []

        class Fake(lp.Twenty):
            def call(self, method, path, body=None):
                calls.append(method)
                return {"data": {"companies": [{"metaPageId": "x", "leadStatus": "DO_NOT_CALL",
                                                "phone": {"primaryPhoneNumber": lp.digits(ph)}}]},
                        "pageInfo": {"hasNextPage": False}}
        orig, lp.Twenty = lp.Twenty, Fake
        self.addCleanup(setattr, lp, 'Twenty', orig)
        lp.import_leads(self.db, NS(apply=False, niche_filter=None, limit=100, status=None, niche=None, state=None, uncalled=None))
        self.assertEqual(set(calls), {"GET"})

    def test_refill_dry_run_spends_nothing(self):
        lp.refill(self.db, NS(target_days=3, pages=3, budget=1.0, max_enrich=60, max_credits=400, apply=False,
                              db="x", dnc_file=None))
        self.assertEqual(eng.SPEND["treg"], 0.0)

    def test_company_body_matches_twenty_phone_shape(self):
        r = {"name": "A", "niche": "roofing", "meta_page_id": "1", "live_ads": 3, "status": "DIAL_READY", "reason": "",
             "state": "TX", "best_phone": "(817) 966-9605", "website": "", "ad_library_link": "", "facebook_page": "",
             "oldest_ad_days": "", "new_ads_30d": 0}
        c = lp.company_body(r)
        self.assertEqual(c["phone"]["primaryPhoneNumber"], "8179669605")
        self.assertEqual(c["niche"], "ROOFING")


if __name__ == "__main__":
    unittest.main()
