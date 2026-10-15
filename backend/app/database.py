import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone

try:
    from pymongo import MongoClient
except Exception:
    MongoClient = None

def utc_now():
    return datetime.now(timezone.utc).isoformat()

class Repository:
    """MongoDB Atlas adapter with a reliable SQLite local-development fallback."""
    def __init__(self, mongo_uri="", mongo_database="carewell_demo", sqlite_path="backend/carewell_local.db", root=None):
        self.client = None
        self.db = None
        self.root = Path(root or Path.cwd())
        path = Path(sqlite_path)
        self.sqlite_path = path if path.is_absolute() else self.root / path
        self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        self.backend_name = "SQLite (local development)"
        if mongo_uri and MongoClient:
            try:
                client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2500)
                client.admin.command("ping")
                self.client, self.db = client, client[mongo_database]
                self.backend_name = "MongoDB Atlas"
            except Exception:
                self.client, self.db = None, None
        if self.db is None:
            self._init_sqlite()

    def _connect(self):
        conn = sqlite3.connect(self.sqlite_path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite(self):
        with self._connect() as conn:
            conn.executescript("CREATE TABLE IF NOT EXISTS workers (id TEXT PRIMARY KEY, document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS interventions (id TEXT PRIMARY KEY, document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS outcomes (id TEXT PRIMARY KEY, document TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, actor TEXT, action TEXT, details TEXT);")

    def ensure_seeded(self, seed):
        """Insert missing demo records without overwriting records already changed in the UI."""
        if self.db is not None:
            for collection_name in ("workers", "interventions"):
                collection = self.db[collection_name]
                for document in seed[collection_name]:
                    collection.update_one({"id": document["id"]}, {"$setOnInsert": document}, upsert=True)
            return

        with self._connect() as conn:
            for table_name in ("workers", "interventions"):
                for document in seed[table_name]:
                    conn.execute(
                        f"INSERT OR IGNORE INTO {table_name}(id, document) VALUES (?, ?)",
                        (document["id"], json.dumps(document)),
                    )

    def _list(self, collection):
        if self.db is not None: return list(self.db[collection].find({}, {"_id": 0}))
        with self._connect() as conn: rows = conn.execute(f"SELECT document FROM {collection}").fetchall()
        return [json.loads(row["document"]) for row in rows]

    def workers(self): return self._list("workers")
    def interventions(self): return self._list("interventions")
    def outcomes(self): return self._list("outcomes")

    def get_worker(self, worker_id):
        if self.db is not None: return self.db.workers.find_one({"id": worker_id}, {"_id": 0})
        with self._connect() as conn: row = conn.execute("SELECT document FROM workers WHERE id = ?", (worker_id,)).fetchone()
        return json.loads(row["document"]) if row else None

    def get_intervention(self, intervention_id):
        if self.db is not None: return self.db.interventions.find_one({"id": intervention_id}, {"_id": 0})
        with self._connect() as conn: row = conn.execute("SELECT document FROM interventions WHERE id = ?", (intervention_id,)).fetchone()
        return json.loads(row["document"]) if row else None

    def save_intervention(self, doc):
        doc["updated_at"] = utc_now()
        if self.db is not None: self.db.interventions.replace_one({"id": doc["id"]}, doc, upsert=True)
        else:
            with self._connect() as conn: conn.execute("INSERT OR REPLACE INTO interventions(id, document) VALUES (?, ?)", (doc["id"], json.dumps(doc)))

    def add_outcome(self, doc):
        doc.setdefault("created_at", utc_now())
        if self.db is not None: self.db.outcomes.insert_one(doc)
        else:
            with self._connect() as conn: conn.execute("INSERT OR REPLACE INTO outcomes(id, document) VALUES (?, ?)", (doc["id"], json.dumps(doc)))

    def audit(self, action, actor, details):
        event = {"created_at": utc_now(), "actor": actor, "action": action, "details": details}
        if self.db is not None: self.db.audit.insert_one(event)
        else:
            with self._connect() as conn: conn.execute("INSERT INTO audit(created_at, actor, action, details) VALUES (?, ?, ?, ?)", (event["created_at"], actor, action, json.dumps(details)))

    def audit_events(self, limit=30):
        if self.db is not None: return list(self.db.audit.find({}, {"_id": 0}).sort("created_at", -1).limit(limit))
        with self._connect() as conn: rows = conn.execute("SELECT created_at, actor, action, details FROM audit ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [{"created_at": r["created_at"], "actor": r["actor"], "action": r["action"], "details": json.loads(r["details"])} for r in rows]
