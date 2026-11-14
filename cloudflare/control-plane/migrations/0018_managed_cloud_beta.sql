CREATE TABLE managed_cloud_beta (
  principal TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT UNIQUE,
  requested_at TEXT,
  CHECK ((workspace_id IS NULL) = (requested_at IS NULL))
);
