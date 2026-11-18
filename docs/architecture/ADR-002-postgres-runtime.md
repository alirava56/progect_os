# ADR 002 — PostgreSQL runtime and transition from SQLite

Date 2026-11-19. Implemented for the private release candidate.

## Decision

Keep the Next.js application and existing record payloads. Select PostgreSQL through `PROJECTOS_DATABASE_URL`; production builds outside loopback require PostgreSQL. SQLite remains a local-development and migration source. All HTTP business paths use one asynchronous SQL executor with parameterized statements and a bounded PostgreSQL pool. Both engines implement the same repository contracts.

Use one row per record and a workspace-scoped primary key. PostgreSQL applies a deferred composite foreign key to project membership of a record. SQLite enforces the relationship in the transactional domain layer. Resource sharing and dependency graphs are validated inside transactions against the affected collections. Payloads retain their historical JSON format so imported records preserve optional fields and values. Historical IDs, scrypt salts and hashes, encrypted TOTP state, document versions, sessions, invites, audit rows and delivery history survive the import.

The workspace version is a monotonic read watermark. A new record write locks the workspace, checks current membership and the revisions of touched rows, validates the resulting graph and updates rows and audit together. This serializes transaction commit ordering while allowing independent records to be edited from the same read watermark. PostgreSQL reads use repeatable-read snapshots. Record versions and tombstones protect stale updates, deletes and re-creates. The old owner snapshot write is for loopback preview compatibility and is disabled where MFA is required.

## Consequences

The UI uses the atomic record write endpoint, then reads back the authoritative state. A successful database commit and a failed refresh have distinct user feedback. There is one active Workspace per account. Explicit project grants apply to Editors and Viewers and are checked at the database boundary on each request. Existing all-workspace memberships retain their scope until the owner changes it. Vault metadata remains Owner-only.

Hosted environments should separate the migration role, runtime role and backup role. Do not grant the runtime role UPDATE or DELETE on audit events. Use trusted reverse-proxy configuration for client IP attribution and TLS. Run the PostgreSQL schema migration before starting the application. PostgreSQL URL connection overrides are rejected; remote connections verify TLS.

## Open design work

Tasks, resources, billing subtypes and extension records still use JSON payload rows. The current implementation does not claim the proposed fully normalized schema, RLS, FX ledger or multi-workspace identity selection. PostgreSQL 17.12 was used for the Windows test environment and the CI definition uses PostgreSQL 16. The legacy SQL sketch remains historical. See [current ERD](ERD.md) and [migration runbook](../migrations/SQLITE-TO-POSTGRES-FA.md).