from pathlib import Path
from flask import Flask, jsonify, send_from_directory
from backend.app.config import Config
from backend.app.database import Repository
from backend.app.ml_engine import RiskEngine
from backend.app.demo_data import seed_demo_records
from backend.app.routes import api
from backend.app.auth import auth

ROOT = Path(__file__).resolve().parents[2]

def create_app(test_config=None):
    app = Flask(__name__, static_folder=str(ROOT / "frontend"), static_url_path="/static")
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
    app.repository = Repository(app.config.get("MONGODB_URI"), app.config.get("MONGODB_DATABASE", "carewell_demo"), app.config.get("SQLITE_PATH", "backend/carewell_local.db"), ROOT)
    app.risk_engine = RiskEngine()
    app.repository.ensure_seeded(seed_demo_records())
    app.register_blueprint(auth, url_prefix="/api/auth")
    app.register_blueprint(api, url_prefix="/api")

    @app.get("/")
    def index():
        return send_from_directory(ROOT / "frontend", "index.html")

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "CareWell API", "storage": app.repository.backend_name, "model": app.risk_engine.model_name, "demo_mode": True})

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def internal_error(_error):
        return jsonify({"error": "Unexpected server error"}), 500

    return app
