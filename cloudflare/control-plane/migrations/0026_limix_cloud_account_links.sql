CREATE TABLE limix_cloud_account_links (
  principal TEXT PRIMARY KEY NOT NULL,
  public_id TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(12))))
);
