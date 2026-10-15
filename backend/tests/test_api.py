import tempfile
import unittest
from pathlib import Path
from backend.app import create_app

class CareWellApiTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.app=create_app({"TESTING":True,"SECRET_KEY":"test-secret","MONGODB_URI":"","SQLITE_PATH":str(Path(self.temp.name)/"test.db")})
        self.client=self.app.test_client()
    def tearDown(self): self.temp.cleanup()
    def login(self,role="worker"): return self.client.post("/api/auth/login",json={"role":role})
    def test_health(self): self.assertEqual(self.client.get("/api/health").json["status"],"ok")
    def test_protected_route(self): self.assertEqual(self.client.get("/api/overview").status_code,401)
    def test_worker_self_detail(self): self.login(); self.assertEqual(self.client.get("/api/workers/worker-001").status_code,200)
    def test_worker_cannot_view_other(self): self.login(); self.assertEqual(self.client.get("/api/workers/worker-002").status_code,403)
    def test_manager_cannot_view_individual_detail(self): self.login("manager"); self.assertEqual(self.client.get("/api/workers/worker-002").status_code,403)
    def test_generate_recommendations(self): self.login("occupational_health"); r=self.client.post("/api/interventions/generate/worker-001"); self.assertEqual(r.status_code,201); self.assertTrue(r.json["interventions"])
    def test_update_intervention(self): self.login("manager"); r=self.client.patch("/api/interventions/int-001",json={"status":"Approved","note":"Reviewed"}); self.assertEqual(r.status_code,200); self.assertEqual(r.json["intervention"]["status"],"Approved")
    def test_invalid_status(self): self.login("manager"); self.assertEqual(self.client.patch("/api/interventions/int-001",json={"status":"Magic"}).status_code,400)
    def test_insufficient_history(self): self.login(); r=self.client.post("/api/predict",json={"weekly_hours":50,"history_points":1}); self.assertEqual(r.json["risk_level"],"Insufficient evidence")

if __name__=="__main__": unittest.main()
