-- Limix Bot: one remote address (Cloudflare tunnel) per Limix account. Every account keeps only its most recently
-- seen active installation; the others are revoked here, and the cleanup cron then deletes their tunnels and DNS
-- records (sweepManagedEndpointCleanup picks up endpoints of revoked installations).
UPDATE installation_credentials
   SET revoked_at = CAST(strftime('%s','now') AS INTEGER) * 1000
 WHERE revoked_at IS NULL
   AND installation_id IN (
     SELECT i.id FROM installations i
      WHERE i.revoked_at IS NULL AND i.owner_user_id LIKE 'limix:%'
        AND i.id <> (
          SELECT k.id FROM installations k
           WHERE k.owner_user_id = i.owner_user_id AND k.revoked_at IS NULL
           ORDER BY COALESCE(k.last_seen_at, k.created_at) DESC, k.created_at DESC LIMIT 1));

DELETE FROM installation_push_devices
 WHERE installation_id IN (
   SELECT i.id FROM installations i
    WHERE i.revoked_at IS NULL AND i.owner_user_id LIKE 'limix:%'
      AND i.id <> (
        SELECT k.id FROM installations k
         WHERE k.owner_user_id = i.owner_user_id AND k.revoked_at IS NULL
         ORDER BY COALESCE(k.last_seen_at, k.created_at) DESC, k.created_at DESC LIMIT 1));

UPDATE installations
   SET revoked_at = CAST(strftime('%s','now') AS INTEGER) * 1000,
       updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000
 WHERE revoked_at IS NULL AND owner_user_id LIKE 'limix:%'
   AND id <> (
     SELECT k.id FROM installations k
      WHERE k.owner_user_id = installations.owner_user_id AND k.revoked_at IS NULL
      ORDER BY COALESCE(k.last_seen_at, k.created_at) DESC, k.created_at DESC LIMIT 1);
