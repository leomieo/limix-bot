ALTER TABLE managed_cloud_beta ADD COLUMN power_desired TEXT NOT NULL DEFAULT 'awake';
ALTER TABLE managed_cloud_beta ADD COLUMN power_since INTEGER NOT NULL DEFAULT 0;
ALTER TABLE managed_cloud_beta ADD COLUMN next_due_at INTEGER;
ALTER TABLE managed_cloud_beta ADD COLUMN sleep_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE managed_cloud_beta ADD COLUMN sleep_blocked INTEGER NOT NULL DEFAULT 1;
ALTER TABLE managed_cloud_beta ADD COLUMN power_observed TEXT NOT NULL DEFAULT 'awake';
ALTER TABLE managed_cloud_beta ADD COLUMN power_revision INTEGER NOT NULL DEFAULT 0;
