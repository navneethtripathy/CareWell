from datetime import datetime, timezone

def seed_demo_records():
    now = datetime.now(timezone.utc).isoformat()
    workers = [
        {"id":"worker-001","name":"Asha Menon","role":"Nurse","department":"Emergency Medicine","weekly_hours":48,"overtime_hours":8,"night_shifts_28d":7,"consecutive_shifts":3,"rest_hours":9,"sleep_hours":6.2,"workload_index":0.82,"staffing_pressure":0.76,"wellbeing_score":57,"history_points":8,"assessment_opt_in":True,"updated_at":now},
        {"id":"worker-002","name":"Arjun Nair","role":"Resident","department":"Emergency Medicine","weekly_hours":56,"overtime_hours":14,"night_shifts_28d":9,"consecutive_shifts":5,"rest_hours":8,"sleep_hours":5.4,"workload_index":0.91,"staffing_pressure":0.82,"wellbeing_score":43,"history_points":10,"assessment_opt_in":True,"updated_at":now},
        {"id":"worker-003","name":"Meera Iyer","role":"Physician","department":"Emergency Medicine","weekly_hours":39,"overtime_hours":2,"night_shifts_28d":2,"consecutive_shifts":2,"rest_hours":13,"sleep_hours":7.3,"workload_index":0.48,"staffing_pressure":0.55,"wellbeing_score":78,"history_points":12,"assessment_opt_in":True,"updated_at":now},
        {"id":"worker-004","name":"Kavya Rao","role":"Nurse","department":"Emergency Medicine","weekly_hours":45,"overtime_hours":5,"night_shifts_28d":5,"consecutive_shifts":3,"rest_hours":10,"sleep_hours":6.5,"workload_index":0.72,"staffing_pressure":0.71,"wellbeing_score":61,"history_points":7,"assessment_opt_in":True,"updated_at":now},
        {"id":"worker-005","name":"Rohan Das","role":"Support Staff","department":"Emergency Medicine","weekly_hours":36,"overtime_hours":1,"night_shifts_28d":1,"consecutive_shifts":2,"rest_hours":14,"sleep_hours":7.5,"workload_index":0.42,"staffing_pressure":0.46,"wellbeing_score":82,"history_points":10,"assessment_opt_in":False,"updated_at":now},
    ]
    interventions = [
        {"id":"int-001","worker_id":"worker-001","worker_name":"Asha Menon","title":"Review consecutive shifts","category":"Schedule","priority":"High","description":"Review the recent sequence of long shifts and recovery time.","status":"Proposed","created_at":now,"updated_at":now,"owner":"Manager review required","note":""},
        {"id":"int-002","worker_id":"worker-002","worker_name":"Arjun Nair","title":"Review workload and coverage","category":"Workload","priority":"High","description":"Review workload distribution and department coverage before changing any roster.","status":"Proposed","created_at":now,"updated_at":now,"owner":"Authorized reviewer","note":""},
        {"id":"int-003","worker_id":"department-emergency","worker_name":"Emergency Medicine team","scope":"department","department":"Emergency Medicine","title":"Review team workload and shift recovery","category":"Workload","priority":"High","description":"Review aggregate workload, shift coverage and recovery patterns across the department. Confirm staffing and skill mix before changing the roster.","status":"Proposed","created_at":now,"updated_at":now,"owner":"Department manager review","note":""},
    ]
    return {"workers": workers, "interventions": interventions}
