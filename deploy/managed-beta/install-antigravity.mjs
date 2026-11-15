import { execFileSync } from "node:child_process";
import { mkdirSync, openSync, closeSync, chmodSync, statSync } from "node:fs";
import { resolveAntigravityReleaseAsset } from "./antigravity-release.ts";

const asset = resolveAntigravityReleaseAsset();
if (!asset) throw new Error("No pinned Antigravity release for this platform");
const archive = "/tmp/antigravity.zip";
execFileSync("curl", ["--fail", "--location", "--retry", "3", "--output", archive, asset.url], { stdio: "inherit" });
if (statSync(archive).size !== asset.archiveBytes) throw new Error("Incomplete Antigravity archive");
execFileSync("sha256sum", ["--check", "--status"], { input: asset.sha256 + "  " + archive + "\n" });
const entries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" }).trim().split("\n");
const dir = "/opt/limix-antigravity";
mkdirSync(dir);
for (const { name, bytes } of [asset.executable, asset.harness]) {
  const matches = entries.filter(path => path.split("/").at(-1) === name);
  if (matches.length !== 1) throw new Error("Expected one archive member for " + name);
  const path = dir + "/" + name;
  const fd = openSync(path, "wx");
  try { execFileSync("unzip", ["-p", archive, matches[0]], { stdio: ["ignore", fd, "inherit"] }); }
  finally { closeSync(fd); }
  if (statSync(path).size !== bytes) throw new Error("Incorrect member size for " + name);
  chmodSync(path, 0o755);
}
