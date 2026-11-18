# Continuation plan for Codex — ProjectOS

The codebase is no longer the original display-only prototype. See `docs/verification/STATUS.md` and `AGENTS.md` first. Continue from the real changed files; do not overwrite the new local persistence, session logic or loss-of-data precautions.

## Next approved engineering queue (dependency order)

1. **PH00 Gate:** Obtain a clean Linux/Windows Next build and Playwright run with `npm ci --include=optional`; port the legacy 20 E2E tests to authenticated owner / seeded data without skips or weakened assertions; RTL/mobile contrast audit.
2. **PH01:** Final ERD/API contracts, migrate serialized SQLite record model into real relational entities; document schema ID migration (current local IDs may be strings). Author ADR for PostgreSQL+Prisma.
3. **PH02:** PostgreSQL adapter, transactional migrations, account MFA, recovery, rate limit with proxy-aware IP and CSRF negative tests; multi-session management.
4. **PH03:** Server-owned domain commands rather than full JSON snapshot; optimistic per-record ETags, permission matrix, team invite workflow, document attachment storage and task approval rules.
5. **PH04:** External Vault integration. Store only provider reference, test deny/revoke/rotation and no secret data in client/AI/exports.
6. **PH05:** Persistent queue with retries, email/Telegram opt-in, timezone recurrence and expiration, encrypted off-host backups and staging restore drill.
7. **PH06:** Read-only GitHub and Monitoring integrations through security-reviewed adapters (signature validation, SSRF defense, provenance, TTL), no fake green state.
8. **PH07:** Contracts, renewals, recurring charges, revenue and cost allocation with ledger-backed tests.
9. **PH08:** Permission-aware RAG with citations, evidence freshness, hallucination abstention and prompt-injection tests; no auto execution.
10. **PH09:** Independent security review, dependency scanning, Firefox/WebKit E2E, WCAG 2.2 AA, load/soak, backup RTO/RPO and rollbacks; release gate.

All phases require verified tests, audit report and rollback path. Do not call the application finished or secure for real VPS credentials until every P0 gate is met.
