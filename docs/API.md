# API reference

Session-based demo API. The role selector is not production identity verification.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Service status and storage adapter |
| POST | `/api/auth/login` | Public | Demo sign-in: `{"role":"worker"}` |
| GET | `/api/auth/me` | Public | Current session |
| POST | `/api/auth/logout` | Public | Clear session |
| GET | `/api/overview` | Signed in | Summary metrics |
| GET | `/api/workers` | Signed in | Worker list with limited fields |
| GET | `/api/workers/<id>` | Worker self / occupational health / admin | Individual detail and prediction |
| POST | `/api/predict` | Signed in | Ad-hoc demo prediction |
| GET | `/api/interventions` | Signed in | Intervention list |
| POST | `/api/interventions/generate/<id>` | Occupational health / admin | Generate and save suggestions |
| PATCH | `/api/interventions/<id>` | Manager / occupational health / admin | Update review status |
| GET | `/api/outcomes` | Signed in | Follow-up records |
| POST | `/api/outcomes` | Occupational health / admin | Add follow-up record |
| GET | `/api/audit` | Occupational health / admin | Recent audit events |
| GET | `/api/model` | Signed in | Model metadata and disclaimer |

If data/history is insufficient, the prediction percentage is null and no Low/Moderate/High category is assigned.
