# CareWell release-candidate QA checklist

## Static checks completed in this environment
- [x] Python files compile with `python -m compileall -q backend`.
- [x] Frontend JavaScript parses with `node --check frontend/js/app.js`.
- [x] UI assets are local; no CDN is required.
- [x] Privacy fixes: manager worker list is aggregate-only; manager intervention list is department-only; manager follow-up records are not exposed individually.
- [x] Added a department-level intervention for the manager demo.
- [x] Added a stale-render guard to prevent slow page requests replacing a page the user has navigated away from.
- [x] Added handling for non-finite prediction inputs.
- [x] Added API tests for manager privacy, intervention authorization, and non-finite input validation.
- [x] Synthetic model limitations are disclosed in UI and docs.

## Runtime checks not completed here
- [ ] Backend unit tests: Flask, NumPy and scikit-learn are not installed in this environment; package installation failed because the package index was unreachable.
- [ ] Full browser end-to-end testing against the live Flask backend was not completed.
- [ ] MongoDB Atlas was not tested because no connection string was provided.

Do not treat the unchecked items as passing. Run the steps below on the machine used for the demo.

## First-run verification
1. Run `pip install -r requirements.txt`.
2. Start using `python -m backend.run` (or `run_windows.bat` on Windows).
3. Open `http://127.0.0.1:5000/api/health` and confirm `status` is `ok`.
4. Sign in as each role: Worker, Department Manager, Occupational Health and Administrator.
5. As Manager, confirm the dashboard shows aggregates, the individual worker list is hidden, and the Intervention Centre shows the department-level review item only. Approve it, refresh, and confirm it remains approved.
6. As Worker, confirm only Asha's own well-being page and own intervention records are shown.
7. As Occupational Health, generate a review plan and add a follow-up record. Refresh and confirm both persist.
8. As Administrator, inspect Trust & Governance and recent audit events.
9. Toggle offline simulation, change an intervention status, restore online mode and confirm queue sync.
10. Run `python -m unittest discover -s backend/tests -v`.
11. If using Atlas, verify the storage label in `/api/health` says `MongoDB Atlas`; otherwise the app uses SQLite fallback.

## Before public deployment
Replace demo role-selector login with real authentication, add CSRF protections and rate limiting, configure HTTPS and secure secrets, perform a full security review, and complete appropriate model validation and governance.
