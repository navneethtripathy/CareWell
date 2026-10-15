# CareWell 3-minute demo script

## Before presenting
1. Install dependencies with `pip install -r requirements.txt`.
2. Start with `python -m backend.run`.
3. Open `http://127.0.0.1:5000` and keep the terminal running.
4. Confirm the app's footer shows the active persistence adapter.
5. Explain that all worker records and model labels are synthetic demonstration data.

## 0:00–0:30 — The problem
Say: “CareWell connects early workforce risk signals with explainability, practical intervention planning and follow-up. It is preventive decision support, not a diagnosis.”

## 0:30–1:00 — Worker view
Sign in as Worker. Show the risk category, workload and recovery signals, contributing factors, and the explicit synthetic-model disclaimer. Explain that feature contributions are not causal proof.

## 1:00–1:40 — Department view
Sign out and sign in as Department Manager. Show aggregate risk distribution and team-level workload/shift patterns. Point out that the manager view does not expose individual well-being scores.

## 1:40–2:20 — Intervention review
Open Interventions. Select the department-level proposal, change its status to Approved, and save. Refresh the page to demonstrate persistence. Explain that the recommendation is reviewed by a human and must be checked against staffing, coverage, skill mix, recovery and fairness.

## 2:20–2:50 — Follow-up and governance
Sign in as Occupational Health. Generate a review plan and add a sample follow-up. Open Trust & Governance to show audit events and model limitations.

## 2:50–3:00 — Close
Say: “The differentiator is the full loop: forecast, explain, distinguish individual from systemic patterns, propose feasible action, keep humans in control and monitor follow-up.”

## Important
Never present demo risk percentages as validated accuracy, real-world probability or clinical evidence. Do not use demo predictions for employment decisions.
