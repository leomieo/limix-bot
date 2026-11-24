import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { migrateWindowsProfile } from "./limix-profile.mjs";

test("moves only an identified Limix profile and gives an existing destination precedence", t => {
  const root = mkdtempSync(join(tmpdir(), "limix-profile-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const old = join(root, "openmausbot"), current = join(root, "limixbot");
  mkdirSync(old);
  migrateWindowsProfile(root);
  assert.equal(existsSync(current), false);
  writeFileSync(join(old, "limix-account.json"), "fixture");
  migrateWindowsProfile(root);
  assert.equal(readFileSync(join(current, "limix-account.json"), "utf8"), "fixture");
  mkdirSync(old);
  writeFileSync(join(old, "limix-account.json"), "second profile");
  migrateWindowsProfile(root);
  assert.equal(readFileSync(join(current, "limix-account.json"), "utf8"), "fixture");
  assert.equal(readFileSync(join(old, "limix-account.json"), "utf8"), "second profile");
});
