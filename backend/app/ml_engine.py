"""Synthetic-data demo model. It is not validated for real-world burnout prediction."""
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = ["weekly_hours", "overtime_hours", "night_shifts_28d", "consecutive_shifts", "rest_hours", "sleep_hours", "workload_index", "staffing_pressure", "wellbeing_score"]
FEATURE_LABELS = {"weekly_hours":"Weekly working hours", "overtime_hours":"Overtime hours", "night_shifts_28d":"Night shifts (28 days)", "consecutive_shifts":"Consecutive shifts", "rest_hours":"Rest between shifts", "sleep_hours":"Sleep duration", "workload_index":"Workload index", "staffing_pressure":"Staffing pressure", "wellbeing_score":"Self-reported well-being"}

class RiskEngine:
    model_name = "Synthetic demo logistic regression (not validated)"
    def __init__(self):
        rng = np.random.default_rng(24)
        n = 1200
        x = np.column_stack([rng.normal(44,9,n).clip(24,80), rng.gamma(2,3,n).clip(0,30), rng.poisson(4,n).clip(0,14), rng.poisson(3,n).clip(1,8), rng.normal(11,2.8,n).clip(4,18), rng.normal(6.7,1.1,n).clip(3,10), rng.beta(3,2,n), rng.beta(3,2.5,n), rng.normal(68,15,n).clip(10,100)])
        z = 0.055*(x[:,0]-40)+0.075*x[:,1]+0.13*x[:,2]+0.18*(x[:,3]-2)-0.18*(x[:,4]-10)-0.35*(x[:,5]-7)+2.4*(x[:,6]-0.5)+1.8*(x[:,7]-0.5)-0.035*(x[:,8]-65)+rng.normal(0,0.8,n)
        p = 1/(1+np.exp(-z)); y = (rng.random(n)<p).astype(int)
        self.pipeline = Pipeline([("scale",StandardScaler()),("model",LogisticRegression(max_iter=1000,random_state=24))])
        self.pipeline.fit(x,y)

    def predict(self, worker):
        missing = [f for f in FEATURES if worker.get(f) is None]
        try:
            history_points = int(worker.get("history_points", 0))
            values = [float(worker[f]) for f in FEATURES if worker.get(f) is not None]
            finite = all(np.isfinite(value) for value in values)
        except (TypeError, ValueError):
            history_points, finite = 0, False
        if missing or not finite or history_points < 4:
            return {"worker_id":worker.get("id"),"risk_percent":None,"risk_level":"Insufficient evidence","data_sufficient":False,"missing_features":missing,"explanation":[],"disclaimer":"Demo model only. Insufficient history or feature coverage; no risk category assigned.","model_name":self.model_name}
        row = np.array([[float(worker[f]) for f in FEATURES]])
        probability = float(self.pipeline.predict_proba(row)[0,1]); percent = int(round(probability*100))
        level = "High" if probability >= 0.67 else "Moderate" if probability >= 0.38 else "Low"
        standardized = self.pipeline.named_steps["scale"].transform(row)[0]
        contributions = standardized*self.pipeline.named_steps["model"].coef_[0]
        explanation = sorted([{"feature":FEATURE_LABELS[f],"value":round(float(v),3),"direction":"increases demo score" if v>0 else "decreases demo score","magnitude":round(abs(float(v)),3)} for f,v in zip(FEATURES,contributions)],key=lambda item:item["magnitude"],reverse=True)[:5]
        return {"worker_id":worker.get("id"),"risk_percent":percent,"risk_level":level,"data_sufficient":True,"missing_features":[],"explanation":explanation,"model_name":self.model_name,"disclaimer":"Illustrative output from a model trained on synthetic labels; not validated for real-world use."}
