# ProjectOS HTTP contract

Application API responses containing workspace or authentication data are private and uncached. Browser mutations require an explicit Origin matching the deployment origin. Bodies are streamed with byte limits. Error responses use a descriptive status. The session cookie is HttpOnly, SameSite Strict and Secure in a production build.

| Route | Method | Behavior |
|---|---|---|
| `/api/auth/setup` | POST | Creates the initial owner using the server-side one-time bootstrap token. |
| `/api/auth/login`, `/api/auth/accept-invite`, `/api/auth/logout` | POST | Bounded JSON credentials, second factor when enrolled, one-time recovery and session rotation. Bootstrap and login report `enrollmentRequired` when appropriate. |
| `/api/auth/me`, `/api/auth/mfa`, `/api/auth/sessions` | GET | Account state, enrollment status and session metadata. Pending-enrollment accounts can use the MFA endpoint. |
| `/api/auth/mfa`, `/api/auth/sessions` | POST | MFA enrollment or rotation, recovery issuance, session revocation. Sensitive operations require reauthentication and a fresh factor where enrolled. |
| `/api/state` | GET | Authorized view of the Workspace and current watermark. Project membership filters records, histories, and relational IDs. |
| `/api/state` | PUT | Local compatibility for Owner. Full revision gate. Denied where MFA is required. |
| `/api/records/{kind}/{id}` | GET | Authorized individual record with `version` and `recordVersion`. Hidden and missing records return 404. |
| `/api/records/{kind}/{id}` | POST, PUT, DELETE | Bounded record create/replace/delete. `concurrency: "record"` indicates row conflict semantics. Without it, the legacy caller still gets strict workspace revision checks. |
| `/api/records` | PATCH | Transactional record changes and optional Owner preferences. Errors reject the entire batch. |
| `/api/docs/history?id=...` | GET | Authorized history, including the project scope of each historical revision. |
| `/api/activity` | POST | Owner activity for a known project, with quota and pattern guard. |
| `/api/team/invitations` | GET, POST, DELETE | Owner invitation list, issue, revoke. `projectIds: null` allows workspace scope. An array defines explicit grants. |
| `/api/team/members/{id}` | PATCH, DELETE | Owner project grants and membership removal. Revocation takes effect on subsequent requests. |
| `/api/vault/{id}` | GET, POST | Owner metadata observation. POST requires password and enrolled second factor. |
| `/api/monitoring` | GET | Project-scoped HTTPS and machine observations, with time and freshness. |
| `/api/monitoring/observations` | POST | Explicit server-side workspace and resource allowlist, machine credential and bounded observation data. |
| `/api/integrations/github` | GET, POST | Owner snapshot read and explicit read-only synchronization for configured repositories. |
| `/api/integrations/github/webhook` | POST | Signed bounded payload and deduplicated delivery for configured mappings. |
| `/api/assistant` | POST | Permission-aware project sources. External requests require explicit query approval and server opts. Returned model selections must occur verbatim in available sources. |
| `/api/health` | GET | Readiness status without identifiers or sensitive metadata. |

Vault references may carry an optional `resourceId`. At write time the resource must belong to, or be shared with, the reference project. The record API rejects resource deletion while a Vault reference remains attached. PostgreSQL and SQLite store the optional field in the existing record payload and continue to read earlier references without backfill.

Resources, tasks and reminders accept optional `noticeDays` values from 0 through 60. A resource needs a renewal date when this value is set. Setting a task's lead time opts that task into the deadline scheduler. Older payloads retain their existing schedule semantics without a backfill. The alert states also include `dismissed` and `resolved`.

Example request with the latest usable Workspace watermark.

```json
{
  "version": 12,
  "changes": [
    { "kind": "reminders", "id": "review", "action": "create",
      "record": { "id": "review", "projectId": "alpha", "title": "Review",
                  "due": "2026-12-01", "kind": "یادآوری", "repeat": "monthly" } }
  ]
}
```

A 409 means a touched revision has advanced or the record already exists. Re-read the workspace or record before trying again. A 422 indicates invalid fields, dates or relations. The caller can expect no partial records on a rejected batch. [Authorization matrix](../security/AUTHZ-MATRIX.md)
