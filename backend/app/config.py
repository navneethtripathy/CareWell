import os

class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "local-demo-only-change-before-deployment")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "0") == "1"
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 8
    MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
    MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "carewell_demo")
    SQLITE_PATH = os.getenv("SQLITE_PATH", "backend/carewell_local.db")
