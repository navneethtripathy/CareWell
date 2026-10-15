from datetime import datetime, timezone
import uuid

ALLOWED_STATUSES = {"Proposed", "Approved", "Modified", "Deferred", "Completed"}

def build_recommendations(worker, prediction):
    if not prediction.get("data_sufficient"):
        items = [("Complete the minimum data review", "Data quality", "Medium", "Review missing inputs and assessment history with the worker before interpreting a risk estimate.")]
    else:
        items = []
        if worker.get("consecutive_shifts",0)>=3 or worker.get("rest_hours",24)<11:
            items.append(("Review shift recovery","Schedule","High","Review consecutive shifts and recovery intervals; check coverage and worker preferences before roster changes."))
        if worker.get("weekly_hours",0)>48 or worker.get("overtime_hours",0)>=6 or worker.get("workload_index",0)>=0.75:
            items.append(("Review workload distribution","Workload","High","Review workload distribution, administrative burden and staffing coverage. Avoid transferring excess workload to another worker."))
        if worker.get("sleep_hours",8)<6.5:
            items.append(("Offer voluntary well-being support","Well-being","Medium","Offer confidential, voluntary well-being resources and discuss whether recovery time can be improved."))
        if not items: items.append(("Maintain preventive check-ins","Follow-up","Low","Continue routine check-ins and reassess trends; a demo score is not proof of no risk."))
    now=datetime.now(timezone.utc).isoformat()
    return [{"id":str(uuid.uuid4()),"worker_id":worker.get("id"),"worker_name":worker.get("name"),"title":title,"category":category,"priority":priority,"description":description,"status":"Proposed","created_at":now,"updated_at":now,"owner":"Human review required","note":""} for title,category,priority,description in items]

def update_status(intervention,status,note=""):
    if status not in ALLOWED_STATUSES: raise ValueError("Unsupported intervention status")
    intervention["status"]=status; intervention["note"]=str(note)[:1000]
    return intervention
