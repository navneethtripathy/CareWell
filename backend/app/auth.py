from functools import wraps
from flask import Blueprint, current_app, jsonify, request, session

auth = Blueprint("auth", __name__)
DEMO_USERS = {
    "worker": {"name": "Asha Menon", "role": "worker", "department": "Emergency Medicine"},
    "manager": {"name": "Dr. Rajesh Kumar", "role": "manager", "department": "Emergency Medicine"},
    "occupational_health": {"name": "Dr. Ananya Rao", "role": "occupational_health", "department": "Emergency Medicine"},
    "admin": {"name": "CareWell Admin", "role": "admin", "department": "All Departments"},
}

def login_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get("user"):
            return jsonify({"error": "Sign in to continue"}), 401
        return fn(*args, **kwargs)
    return wrapped

def roles_required(*roles):
    def decorator(fn):
        @wraps(fn)
        @login_required
        def wrapped(*args, **kwargs):
            if session.get("user", {}).get("role") not in roles:
                return jsonify({"error": "Your role cannot access this resource"}), 403
            return fn(*args, **kwargs)
        return wrapped
    return decorator

@auth.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    role = str(payload.get("role", "")).strip()
    if role not in DEMO_USERS:
        return jsonify({"error": "Choose a valid demo role"}), 400
    session.clear()
    session["user"] = DEMO_USERS[role]
    session.permanent = True
    current_app.repository.audit("login", DEMO_USERS[role]["name"], {"role": role})
    return jsonify({"user": session["user"], "demo_mode": True})

@auth.post("/logout")
def logout():
    user = session.get("user", {})
    if user:
        current_app.repository.audit("logout", user.get("name", "unknown"), {})
    session.clear()
    return jsonify({"ok": True})

@auth.get("/me")
def me():
    return jsonify({"user": session.get("user"), "demo_mode": True})
