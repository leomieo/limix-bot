CREATE TABLE IF NOT EXISTS limix_cloud_resource_overrides (
  principal TEXT PRIMARY KEY,
  cpus INTEGER NOT NULL CHECK(cpus BETWEEN 1 AND 16),
  memory_gb INTEGER NOT NULL CHECK(memory_gb BETWEEN 2 AND 32),
  updated_at INTEGER NOT NULL
);
