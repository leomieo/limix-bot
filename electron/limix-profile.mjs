import { existsSync, lstatSync, renameSync } from "node:fs";
import { join } from "node:path";

export function migrateWindowsProfile(appData) {
  const target = join(appData, "limixbot");
  const legacy = join(appData, "openmausbot");
  if (existsSync(target) || !existsSync(legacy)) return;
  const info = lstatSync(legacy);
  if (!info.isDirectory() || info.isSymbolicLink() || !existsSync(join(legacy, "limix-account.json"))) return;
  renameSync(legacy, target);
}
