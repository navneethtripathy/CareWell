from pathlib import Path
import os
from dotenv import load_dotenv
from backend.app import create_app

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
app = create_app()

if __name__ == "__main__":
    app.run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG", "0") == "1")
