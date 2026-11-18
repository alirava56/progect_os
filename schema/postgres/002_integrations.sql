CREATE TABLE vault_checks (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ref_id TEXT NOT NULL,
  reference_version BIGINT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('verified','unknown','not_found')),
  provider_version INTEGER,
  PRIMARY KEY(workspace_id, ref_id)
);
CREATE TABLE github_snapshots (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(workspace_id, project_id, repo)
);
CREATE TABLE github_deliveries (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  delivery_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(workspace_id, project_id, repo, delivery_id),
  UNIQUE (workspace_id, project_id, repo, payload_hash)
);