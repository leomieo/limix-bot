// Tokens and API keys are stored encrypted (AES-256-GCM) in data/secrets.json with a random key in data/master.key.
// This protects against casual copying of the state file, not against someone who can read the whole data folder.
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ensureDir, readJson, writeJsonAtomic } from "./util/files.mjs";
import { registerSecret } from "./util/redact.mjs";

export class SecretStore {
  constructor(dataDir) {
    ensureDir(dataDir);
    this.file = join(dataDir, "secrets.json");
    const keyFile = join(dataDir, "master.key");
    if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString("base64"), { mode: 0o600 });
    this.key = Buffer.from(readFileSync(keyFile, "utf8").trim(), "base64");
    if (this.key.length !== 32) throw new Error("data/master.key is damaged");
    this.items = readJson(this.file, {});
    for (const ref of Object.keys(this.items)) registerSecret(this.get(ref));
  }

  put(value) {
    const ref = `sec_${randomUUID()}`;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    this.items[ref] = { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
    writeJsonAtomic(this.file, this.items);
    registerSecret(String(value));
    return ref;
  }

  get(ref) {
    const item = this.items[ref];
    if (!item) return undefined;
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(item.iv, "base64"));
    decipher.setAuthTag(Buffer.from(item.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(item.data, "base64")), decipher.final()]).toString("utf8");
  }

  delete(ref) {
    if (!ref || !(ref in this.items)) return;
    delete this.items[ref];
    writeJsonAtomic(this.file, this.items);
  }
}
