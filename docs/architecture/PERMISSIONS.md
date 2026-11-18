# Permissions and workspace tenancy — implemented as a limited preview

| Action | Owner | Developer (`editor`) | Viewer |
|---|---|---|---|
| Read own workspace records except Vault references | yes | yes | yes |
| Read Vault references and their record audit entries | yes | no | no |
| Create projects/resources/secret *references*/finance records | yes | no | no |
| Create/update/delete tasks, docs, reminders and incidents | yes | yes (record API) | no |
| Change workspace preferences | yes | no | no |
| Create/revoke invitations and remove members | yes | no | no |
| Retrieve configured GitHub overview | yes | no | no |
| Trigger external AI synthesis (when enabled by admin) | yes | no | no |
| Manage own TOTP/session | yes | yes | yes |

Only Owner can change roles indirectly through issuing a new invitation; explicit role editing
is not implemented. Invites require an existing private channel to share the one-time code. No
email is sent. A removed user can rejoin with a new invite and their existing password.

Queries are scoped to membership's Workspace ID. The product does not yet support a single
identity belonging to multiple workspaces or per-project access restrictions inside one workspace.
Do not invite people who should not see all workspace metadata.

The legacy `/api/state` endpoint allows only Owner to write; Editor writes go through
`/api/records/{kind}/{id}` with whole-workspace relation validation. This still processes a
Workspace snapshot internally, and does not meet the final PostgreSQL transactional DAL goal.
