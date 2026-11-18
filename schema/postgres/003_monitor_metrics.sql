ALTER TABLE monitor_observations ADD COLUMN tls_expires_at TIMESTAMPTZ;
CREATE TABLE machine_observations (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL,
  cpu_percent REAL NOT NULL CHECK(cpu_percent >= 0 AND cpu_percent <= 100),
  used_bytes BIGINT NOT NULL CHECK(used_bytes >= 0),
  total_bytes BIGINT NOT NULL CHECK(total_bytes > 0 AND used_bytes <= total_bytes),
  PRIMARY KEY(workspace_id, resource_id, checked_at)
);
CREATE INDEX machine_observations_recent ON machine_observations(workspace_id,resource_id,checked_at DESC);