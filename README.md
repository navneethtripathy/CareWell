# CareWell — Healthcare Workforce Risk & Well-being Intelligence System

CareWell is a privacy-conscious **decision-support prototype** for exploring workforce burnout-risk signals, explaining contributing factors, suggesting preventive actions, and following up on outcomes.

> **Demo and safety notice:** This repository includes synthetic demo records and a model trained on synthetic labels. It is for software demonstration and coursework only. Its risk values are not clinically validated, must not be used for employment decisions, and do not establish a diagnosis. Real deployment requires suitable longitudinal data, validated assessments, institutional review, calibration, security review, and human oversight.

## Features
- Responsive, minimal dashboard with worker and department views.
- Flask REST backend with session-based demo authentication and role-aware routes.
- Risk scoring with an interpretable scikit-learn logistic-regression pipeline trained on synthetic demo data.
- Feature-contribution explanations, data-sufficiency guard, and preventive suggestions.
- Human-reviewed intervention lifecycle: approve, modify, defer, complete.
- Follow-up outcome records and audit events.
- MongoDB Atlas persistence when `MONGODB_URI` is configured; SQLite fallback for local development.
- IndexedDB cache and offline action queue in the browser.
- API tests and health endpoint.

## Folder structure
```text
CareWell_Final/
├── backend/app/       # Flask routes, persistence, ML and intervention logic
├── backend/tests/     # API tests
├── frontend/          # HTML, CSS and JavaScript
├── data/              # Data guidance (no real personal data)
├── docs/              # API, model and security notes
├── scripts/           # Smoke test
├── .env.example
├── requirements.txt
└── README.md
```

## Requirements
Python 3.10+. Optional MongoDB Atlas connection string. No external CDN is needed by the frontend.

## Run locally
1. Create a virtual environment:
   - Windows: `py -m venv .venv` then `.venv\Scripts\Activate.ps1`
   - macOS/Linux: `python3 -m venv .venv` then `source .venv/bin/activate`
2. Install: `pip install -r requirements.txt`
3. Copy `.env.example` to `.env`. Leave `MONGODB_URI` blank for local SQLite, or configure Atlas credentials in `.env` (never commit them).
4. Run from the project root: `python -m backend.run`
5. Open `http://127.0.0.1:5000`.

## Demo sign-in
Select Worker, Manager, Occupational Health or Admin. The role selector is **demo-only**, not production authentication. Do not expose this version publicly. Replace it with institutional SSO/OAuth, identity verification and tested authorization before real deployment.

## Demo walkthrough

Follow `docs/DEMO_SCRIPT.md` for a short, repeatable presentation flow. The manager view is aggregate-only; individual details are reserved for the worker and authorized support roles.

## Test
```bash
python -m unittest discover -s backend/tests -v
python scripts/smoke_test.py
```

## Persistence
- `MONGODB_URI` configured and reachable: MongoDB Atlas is used.
- Otherwise: SQLite is created at `backend/carewell_local.db`.
- The browser caches minimal display data and queues user actions in IndexedDB while offline; queued changes sync when the connection returns.

## Model limitation
The app trains a logistic-regression pipeline on synthetic examples with synthetic labels. This makes the demo flow work end-to-end without pretending to have hospital data. See `docs/DATA_AND_MODEL.md`.

## Before real use
Use a validated future assessment target, worker-grouped and temporal evaluation, external validation where possible, calibration and subgroup analysis. Managers should see aggregate department indicators by default, not private individual well-being responses. Never use the score for hiring, firing, promotion, discipline or performance appraisal.
