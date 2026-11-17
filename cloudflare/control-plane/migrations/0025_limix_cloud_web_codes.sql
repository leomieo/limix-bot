-- Limix Cloud's page for customers (GET /cloud): the desktop asks for a one-time code, opens the page with it in the
-- address's fragment, and the page trades it for a short browser sign-in (a limix_cloud_devices row, platform 'web').
CREATE TABLE limix_cloud_web_codes (
  code_hash TEXT PRIMARY KEY NOT NULL,
  principal TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE INDEX limix_cloud_web_codes_expires ON limix_cloud_web_codes(expires_at);
