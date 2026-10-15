# Data and model notes

## Demo input fields
- `weekly_hours`: weekly working hours
- `overtime_hours`: weekly overtime hours
- `night_shifts_28d`: night shifts in the prior 28 days
- `consecutive_shifts`: recent consecutive shifts
- `rest_hours`: rest between shifts
- `sleep_hours`: consented self-reported average sleep
- `workload_index`: illustrative normalized workload, 0–1
- `staffing_pressure`: illustrative normalized staffing pressure, 0–1
- `wellbeing_score`: illustrative self-reported well-being, 0–100
- `history_points`: available historical observations

## Model
`RiskEngine` generates synthetic samples and a synthetic binary target using a transparent formula, then trains scikit-learn logistic regression. The explanation ranks standardized feature contributions; it is model attribution, not causal evidence. Demo thresholds are not validated operating thresholds. The output is not a calibrated real-world burnout probability.

## Required real evaluation
Use a pre-defined future target from a validated assessment; worker-grouped and temporal splits; external validation where possible; calibration; AUROC, PR-AUC, sensitivity, specificity, high-risk recall, false-negative rate, alert burden, subgroup performance and drift monitoring.
