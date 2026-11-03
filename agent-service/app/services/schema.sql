CREATE SCHEMA IF NOT EXISTS agent_ops;
CREATE TABLE IF NOT EXISTS agent_ops.records (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('investigation', 'action', 'audit')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS records_kind_created ON agent_ops.records (kind, created_at);
