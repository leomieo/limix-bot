ALTER TABLE managed_cloud_beta ADD COLUMN runtime_state TEXT
  CHECK(runtime_state IN ('starting','running','failed','waiting_capacity'));
ALTER TABLE managed_cloud_beta ADD COLUMN runtime_seen INTEGER;
