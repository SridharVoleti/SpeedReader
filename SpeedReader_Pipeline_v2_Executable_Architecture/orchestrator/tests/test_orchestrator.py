import tempfile, unittest, json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import orchestrator as o

class OrchestratorTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.db=str(Path(self.tmp.name)/"s.db")
        schema=str(Path(__file__).resolve().parents[1]/"schema.sql")
        o.init_db(self.db,schema); o.register_unit(self.db,"U1","C","H")
    def tearDown(self): self.tmp.cleanup()
    def test_queue_and_next(self):
        jid=o.queue_job(self.db,"U1","2","CREATOR")
        self.assertEqual(o.next_job(self.db)["job_id"],jid)
    def test_retry_cap(self):
        with self.assertRaises(SystemExit): o.queue_job(self.db,"U1","2","CREATOR",4)
        # Upstream-caused rerun does not spend quota
        jid=o.queue_job(self.db,"U1","2","CREATOR",4,upstream_caused=1)
        self.assertTrue(jid)
    def test_duplicate_defect_escalates_early(self):
        con=o.connect(self.db)
        d={"production_unit_id":"U1","detected_by_role":"6S","owner_role":"4","source_hash":"abc","violated_rule_id":"R","actual":"bad","severity":"BLOCKER"}
        _,s1=o.route_defect(con,d); con.commit(); _,s2=o.route_defect(con,d); con.commit(); con.close()
        self.assertEqual(s1,"DELIVERED"); self.assertEqual(s2,"ESCALATED")
    def test_descendants(self):
        self.assertEqual(o.descendants("4"),["5","6","7","8"])

if __name__=='__main__': unittest.main()
