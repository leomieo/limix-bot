CREATE TABLE managed_cloud_host (
  id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
  tunnel_id TEXT NOT NULL,
  routed TEXT NOT NULL DEFAULT '{}',
  configured TEXT
);
