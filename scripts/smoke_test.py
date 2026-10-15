import json
from urllib.request import urlopen
BASE="http://127.0.0.1:5000"
try:
    with urlopen(BASE+"/api/health",timeout=3) as response: result=json.loads(response.read().decode())
    assert response.status==200 and result["status"]=="ok"
    print("PASS: CareWell health endpoint", result)
except Exception as exc:
    print("FAIL: Start the app first with `python -m backend.run`.")
    raise SystemExit(1) from exc
