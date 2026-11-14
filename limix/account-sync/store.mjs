import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { MAX_WIRE_BYTES } from './protocol.mjs';

/** Single-host transactional store. Account IDs come exclusively from the authenticated server session. The 32-byte key is held outside the database. */
export function createAccountSnapshotStore(file, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A 32-byte storage key is required');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS snapshots (account TEXT NOT NULL, revision INTEGER NOT NULL, created INTEGER NOT NULL, content BLOB NOT NULL, PRIMARY KEY(account,revision))');
  const accountKey = account => {
    if (typeof account !== 'string' || !account || account.length > 256) throw new Error('Invalid authenticated account');
    return createHash('sha256').update(account).digest('hex');
  };
  const latest = id => db.prepare('SELECT * FROM snapshots WHERE account=? ORDER BY revision DESC LIMIT 1').get(id);
  return {
    latest(account) {
      const id = accountKey(account), row = latest(id);
      if (!row) return null;
      const blob = Buffer.from(row.content);
      const decipher = createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12));
      decipher.setAAD(Buffer.from(`${id}:${row.revision}`));
      decipher.setAuthTag(blob.subarray(12, 28));
      return { revision: row.revision, createdAt: row.created, bytes: Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]) };
    },
    put(account, expectedRevision, bytes) {
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !Buffer.isBuffer(bytes) || bytes.length > MAX_WIRE_BYTES) throw new Error('Invalid upload');
      const id = accountKey(account);
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = latest(id)?.revision ?? 0;
        if (current !== expectedRevision) {
          const error = new Error('Snapshot conflict'); error.status = 409; throw error;
        }
        const revision = current + 1, createdAt = Date.now(), iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        cipher.setAAD(Buffer.from(`${id}:${revision}`));
        const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
        db.prepare('INSERT INTO snapshots VALUES (?,?,?,?)').run(id, revision, createdAt, Buffer.concat([iv, cipher.getAuthTag(), encrypted]));
        db.prepare('DELETE FROM snapshots WHERE account=? AND revision<=?').run(id, revision - 5);
        db.exec('COMMIT');
        return { revision, createdAt };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); },
  };
}
