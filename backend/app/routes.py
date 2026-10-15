from flask import Blueprint, current_app, jsonify, request, session
from backend.app.auth import login_required, roles_required
from backend.app.interventions import build_recommendations, update_status, ALLOWED_STATUSES
from datetime import datetime, timezone
import uuid

api=Blueprint("api",__name__)
def current_user(): return session.get("user",{})

@api.get("/overview")
@login_required
def overview():
    user = current_user()
    all_workers = current_app.repository.workers()
    if user.get("role") == "worker":
        visible_workers = [worker for worker in all_workers if worker.get("id") == "worker-001"]
    else:
        visible_workers = all_workers

    predictions = [current_app.risk_engine.predict(worker) for worker in visible_workers]
    usable = [prediction for prediction in predictions if prediction.get("risk_percent") is not None]
    average_risk = round(sum(item["risk_percent"] for item in usable) / len(usable)) if usable else None

    interventions = current_app.repository.interventions()
    if user.get("role") == "worker":
        interventions = [item for item in interventions if item.get("worker_id") == "worker-001"]
    elif user.get("role") == "manager":
        interventions = [item for item in interventions if item.get("scope") == "department" and item.get("department") == user.get("department")]

    outcomes = current_app.repository.outcomes()
    if user.get("role") == "worker":
        outcomes = [item for item in outcomes if item.get("worker_id") == "worker-001"]
    elif user.get("role") == "manager":
        # Only the count is returned; individual outcome records are withheld.
        outcomes = []

    return jsonify({
        "user": user,
        "department": user.get("department"),
        "metrics": {
            "workers": len(visible_workers),
            "average_risk": average_risk,
            "high_risk": sum(item["risk_level"] == "High" for item in usable),
            "proposed_interventions": sum(item.get("status") == "Proposed" for item in interventions),
            "followups": len(outcomes) if user.get("role") != "manager" else len(current_app.repository.outcomes()),
        },
        "risk_distribution": {
            level: sum(item.get("risk_level") == level for item in usable)
            for level in ["Low", "Moderate", "High"]
        },
        "model_name": current_app.risk_engine.model_name,
        "storage": current_app.repository.backend_name,
        "demo_mode": True,
    })

@api.get("/workers")
@login_required
def workers():
    user = current_user()
    if user.get("role") == "manager":
        # Managers use aggregate endpoints; no row-level worker data is returned.
        return jsonify({"workers": []})
    docs = current_app.repository.workers()
    if user.get("role") == "worker":
        docs = [worker for worker in docs if worker["id"] == "worker-001"]
    result = []
    for worker in docs:
        prediction = current_app.risk_engine.predict(worker)
        result.append({
            "id": worker["id"], "name": worker["name"], "role": worker["role"],
            "department": worker["department"], "weekly_hours": worker["weekly_hours"],
            "night_shifts_28d": worker["night_shifts_28d"],
            "risk_percent": prediction["risk_percent"], "risk_level": prediction["risk_level"],
            "data_sufficient": prediction["data_sufficient"],
        })
    return jsonify({"workers": result})

@api.get("/workers/<worker_id>")
@login_required
def worker_detail(worker_id):
    user=current_user()
    if user.get("role")=="worker" and worker_id!="worker-001": return jsonify({"error":"Workers can only view their own record"}),403
    if user.get("role") not in {"worker","occupational_health","admin"}: return jsonify({"error":"Individual well-being details are restricted for this role"}),403
    worker=current_app.repository.get_worker(worker_id)
    if not worker: return jsonify({"error":"Worker not found"}),404
    return jsonify({"worker":worker,"prediction":current_app.risk_engine.predict(worker)})

@api.post("/predict")
@login_required
def predict():
    payload=request.get_json(silent=True) or {}; allowed={"weekly_hours","overtime_hours","night_shifts_28d","consecutive_shifts","rest_hours","sleep_hours","workload_index","staffing_pressure","wellbeing_score"}
    worker={k:payload[k] for k in allowed if k in payload}
    try:
        import math
        for key, value in list(worker.items()):
            worker[key] = float(value)
            if not math.isfinite(worker[key]):
                raise ValueError(f"{key} must be a finite number")
        history_points = int(payload.get("history_points", 8))
    except (TypeError, ValueError):
        return jsonify({"error":"All supplied model inputs must be numeric"}),400
    ranges = {"weekly_hours":(0,120),"overtime_hours":(0,80),"night_shifts_28d":(0,31),"consecutive_shifts":(0,31),"rest_hours":(0,48),"sleep_hours":(0,24),"workload_index":(0,1),"staffing_pressure":(0,1),"wellbeing_score":(0,100)}
    for key, value in worker.items():
        low, high = ranges[key]
        if not low <= value <= high: return jsonify({"error":f"{key} must be between {low} and {high}"}),400
    worker["id"]="adhoc-demo"; worker["history_points"]=history_points
    prediction=current_app.risk_engine.predict(worker)
    current_app.repository.audit("ad_hoc_prediction",current_user().get("name","unknown"),{"data_sufficient":prediction["data_sufficient"],"model":prediction["model_name"]})
    return jsonify(prediction)

@api.get("/interventions")
@login_required
def interventions():
    user = current_user()
    docs = current_app.repository.interventions()
    if user.get("role") == "worker":
        docs = [item for item in docs if item.get("worker_id") == "worker-001"]
    elif user.get("role") == "manager":
        # Managers receive department-level operational interventions only.
        docs = [item for item in docs if item.get("scope") == "department" and item.get("department") == user.get("department")]
    return jsonify({"interventions":sorted(docs,key=lambda x:x.get("created_at",""),reverse=True)})

@api.post("/interventions/generate/<worker_id>")
@roles_required("occupational_health","admin")
def generate_interventions(worker_id):
    worker=current_app.repository.get_worker(worker_id)
    if not worker: return jsonify({"error":"Worker not found"}),404
    proposed = build_recommendations(worker, current_app.risk_engine.predict(worker))
    existing = current_app.repository.interventions()
    items = []
    for suggestion in proposed:
        duplicate = next((item for item in existing if
            item.get("worker_id") == worker_id and
            item.get("title") == suggestion.get("title") and
            item.get("status") in {"Proposed", "Approved", "Modified"}), None)
        if duplicate:
            items.append(duplicate)
            continue
        current_app.repository.save_intervention(suggestion)
        items.append(suggestion)
    current_app.repository.audit("generate_interventions", current_user().get("name", "unknown"), {"worker_id": worker_id, "count": len(items)})
    return jsonify({"interventions": items}), 201

@api.patch("/interventions/<intervention_id>")
@roles_required("manager","occupational_health","admin")
def change_intervention(intervention_id):
    payload=request.get_json(silent=True) or {}; status=payload.get("status")
    if status not in ALLOWED_STATUSES: return jsonify({"error":"Choose a valid status"}),400
    item=current_app.repository.get_intervention(intervention_id)
    if not item: return jsonify({"error":"Intervention not found"}),404
    if current_user().get("role") == "manager":
        if item.get("scope") != "department" or item.get("department") != current_user().get("department"):
            return jsonify({"error":"Managers can review department-level interventions only"}),403
    update_status(item,status,payload.get("note","")); current_app.repository.save_intervention(item)
    current_app.repository.audit("intervention_status_changed",current_user().get("name","unknown"),{"intervention_id":intervention_id,"status":status})
    return jsonify({"intervention":item})

@api.get("/outcomes")
@login_required
def outcomes():
    user = current_user()
    docs = current_app.repository.outcomes()
    if user.get("role") == "manager":
        # Managers see only aggregate follow-up counts in /api/overview.
        docs = []
    elif user.get("role") == "worker":
        docs = [item for item in docs if item.get("worker_id") == "worker-001"]
    return jsonify({"outcomes": sorted(docs, key=lambda item: item.get("created_at", ""), reverse=True)})

@api.post("/outcomes")
@roles_required("occupational_health","admin")
def create_outcome():
    payload=request.get_json(silent=True) or {}
    if not payload.get("worker_id") or not payload.get("measure"): return jsonify({"error":"worker_id and measure are required"}),400
    item={"id":str(uuid.uuid4()),"worker_id":str(payload["worker_id"]),"measure":str(payload["measure"])[:100],"value":str(payload.get("value",""))[:100],"notes":str(payload.get("notes",""))[:1000],"created_by":current_user().get("name"),"created_at":datetime.now(timezone.utc).isoformat()}
    current_app.repository.add_outcome(item); current_app.repository.audit("outcome_recorded",current_user().get("name","unknown"),{"worker_id":item["worker_id"],"measure":item["measure"]})
    return jsonify({"outcome":item}),201

@api.get("/audit")
@roles_required("admin","occupational_health")
def audit(): return jsonify({"events":current_app.repository.audit_events()})

@api.get("/model")
@login_required
def model_info():
    return jsonify({"name":current_app.risk_engine.model_name,"features":["weekly_hours","overtime_hours","night_shifts_28d","consecutive_shifts","rest_hours","sleep_hours","workload_index","staffing_pressure","wellbeing_score"],"notice":"Synthetic training data and synthetic labels. Not validated for real-world prediction."})
