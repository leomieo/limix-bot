-- Limix Cloud Admin (docs/cloud-pro.md's Admin half, written for Limix): the desktop's Cloud sign-in, the owner's
-- trial requests, and where each account's computer moved its bots.
CREATE TABLE limix_cloud_devices (
  id TEXT PRIMARY KEY NOT NULL,
  principal TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX limix_cloud_devices_principal ON limix_cloud_devices(principal);

CREATE TABLE limix_cloud_requests (
  principal TEXT PRIMARY KEY NOT NULL,
  requested_at INTEGER NOT NULL,
  decided_at INTEGER,
  decision TEXT CHECK (decision IN ('approved', 'declined'))
);

CREATE TABLE limix_cloud_moves (
  principal TEXT NOT NULL,
  installation TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('moved', 'kept')),
  status TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (principal, installation)
);
