# ProjectOS engineering contract

This source is a hardened private preview, not production-certified.
- Read `docs/verification/RELEASE-GATES-FA.md` and `docs/security/THREAT-MODEL.md` before modifying code.
- Preserve Persian RTL UI and 32 delivered icon assets. No unrequested redesign.
- Never commit or request production credentials. No plaintext secrets in project metadata or model prompts.
- All changes to authentication, permissions, backups, notifications, and AI need negative tests and migrations.
- Favor transactional, workspace-scoped record operations; do not increase reliance on full-snapshot writes.
- All “DONE” claims require build, test evidence, security rationale and operational configuration proof.
- PostgreSQL, Vault, production notifications, offsite restore, and final E2E remain open gates.
- Do not silently skip failing tests, misrepresent monitoring or AI status, or weaken validation to pass CI.

## Critical security review addendum (2026-11-18)

Before changing authentication, alert reconciliation, API body parsing, backup format, or RBAC, read `docs/verification/SECURITY-REVIEW-2026-11-18-FA.md` and run `npm run test:core`. Always add a regression test for any discovered defect. The project is NOT authorized for public deployment or real secrets. Keep `.env*`, DBs, backups, node_modules, and SWC binaries out of the source release package.
