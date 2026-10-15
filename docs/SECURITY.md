# Security and privacy

## Included in this demo
- HttpOnly and SameSite=Lax session cookie.
- Role checks for individual details, intervention changes, outcome creation and audit access.
- Worker role can only access its own seeded record; managers receive a limited list and cannot read individual detailed records through the detail route.
- Audit events for authentication, prediction requests, intervention updates and follow-ups.
- Secrets and MongoDB URI come from environment variables; no real patient data is included.

## Not production-ready
- Demo role selector is not real identity verification.
- No CSRF token, rate limiting, institutional SSO, comprehensive security headers or formal consent workflow.
- Configure least-privilege Atlas credentials, network restrictions, backups, encryption and retention policies.
- Keep individual well-being responses private; managers should see aggregates by default.
- Never use outputs for punitive employment decisions.
