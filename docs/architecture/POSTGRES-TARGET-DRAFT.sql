-- ProjectOS PostgreSQL relational target (DESIGN DRAFT ONLY).
-- NOT executed and NOT wired to the current local SQLite adapter.
-- Before migration: review indexes, constraints, RBAC/RLS and rollback in a staging DB.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','editor','viewer')),
  PRIMARY KEY(user_id,workspace_id)
);
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  status text NOT NULL CHECK(status IN ('building','review','active','archived')),
  description text NOT NULL DEFAULT '',
  progress smallint NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL CHECK(status IN ('todo','doing','blocked','review','done')),
  priority text NOT NULL CHECK(priority IN ('high','medium','low')),
  due_date date,
  description text NOT NULL DEFAULT '',
  assigned_to uuid REFERENCES app_users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE TABLE task_dependencies (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  CHECK(task_id<>depends_on_task_id),
  PRIMARY KEY(task_id,depends_on_task_id)
);
-- Cycle detection still requires transactional domain validation.
CREATE TABLE resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  type text NOT NULL CHECK(type IN ('server','domain','database','service')),
  address text NOT NULL,
  provider text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('Production','Staging','Development')),
  renewal_date date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id)
);
CREATE TABLE project_resources (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  relation text NOT NULL CHECK(relation IN ('primary','linked')),
  PRIMARY KEY(project_id,resource_id)
);
CREATE TABLE resource_relations (
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  parent_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  relation text NOT NULL CHECK(relation IN ('depends_on','hosted_on','backed_up_by','managed_by','exposes','points_to')),
  CHECK(parent_id<>child_id),
  PRIMARY KEY(parent_id,child_id,relation)
);
CREATE TABLE secret_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  provider text NOT NULL,
  external_reference text NOT NULL,
  label text NOT NULL,
  last_verified_at timestamptz,
  -- Never add secret_value or private_key columns.
  UNIQUE(workspace_id,provider,external_reference)
);
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  project_id uuid NOT NULL REFERENCES projects(id),
  title text NOT NULL,
  type text NOT NULL,
  current_revision integer NOT NULL DEFAULT 1 CHECK(current_revision>=1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE document_versions (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK(revision>0),
  body text NOT NULL,
  edited_by uuid NOT NULL REFERENCES app_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(document_id,revision)
);
CREATE TABLE reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  project_id uuid REFERENCES projects(id),
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  timezone text NOT NULL,
  recurrence_rule text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  reminder_id uuid REFERENCES reminders(id),
  scheduled_for timestamptz NOT NULL,
  channel text NOT NULL,
  state text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  delivered_at timestamptz,
  UNIQUE(workspace_id,reminder_id,scheduled_for,channel)
);
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  actor_id uuid REFERENCES app_users(id),
  event_kind text NOT NULL,
  subject_id text NOT NULL,
  event_action text NOT NULL,
  sanitized_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_ws_time ON audit_events(workspace_id,occurred_at DESC);
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  project_id uuid REFERENCES projects(id),
  description text NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor>=0),
  currency text NOT NULL,
  category text NOT NULL,
  expense_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Mandatory before production: workspace RLS, SECURITY DEFINER review, scoped FK
-- enforcement, passwordless or managed session integration, migration rollback,
-- indexes for load, property tests and cross-workspace negative tests.
