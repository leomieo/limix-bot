CREATE TABLE limix_cloud_host_resources (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cpus INTEGER NOT NULL,
  memory_gb REAL NOT NULL,
  capacity INTEGER NOT NULL,
  reported_at INTEGER NOT NULL
);
