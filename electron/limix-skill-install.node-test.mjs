import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { skillPackageSpec, skillInstallPackages, installSkillPackage } from "./limix-skill-install.mjs";

test("registry specs exclude commands, local paths, git URLs and invalid version sources", () => {
  for (const name of ["--global", "../bad", "a;whoami", "https://example.test/x", "a b"]) assert.equal(skillPackageSpec({ kind: "npm", name }), null);
  assert.equal(skillPackageSpec({ kind: "npm", name: "good", required: "git+https://example.test/code" }), null);
  assert.equal(skillPackageSpec({ kind: "python", name: "good", required: "; os_name=='nt'" }), null);
  assert.equal(skillPackageSpec({ kind: "npm", name: "good", required: {} }), null);
  assert.equal(skillPackageSpec({ kind: "npm", name: "@remotion/cli", required: "^4.0.0" }), "@remotion/cli@^4.0.0");
  assert.deepEqual(skillInstallPackages({ kind: "npm", name: "remotion" }), ["remotion", "@remotion/cli"]);
});

test("npm installs use separate arguments in the chosen project and preserve its manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "limix-package-install-"));
  const calls = [];
  try {
    const text = JSON.stringify({ name: "existing-project", private: true, scripts: { dev: "vite" } });
    await writeFile(path.join(root, "package.json"), text);
    await installSkillPackage({ requirement: { kind: "npm", name: "remotion" }, project: root, node: "node", npmCli: "npm-cli.js", run: async (...args) => calls.push(args) });
    assert.deepEqual(calls, [["node", ["npm-cli.js", "install", "--save-exact", "--no-audit", "--no-fund", "--", "remotion", "@remotion/cli"], { cwd: await (await import("node:fs/promises")).realpath(root) }]]);
    assert.equal(await readFile(path.join(root, "package.json"), "utf8"), text);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("Python installs use the project virtual environment", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "limix-python-install-"));
  const calls = [];
  try {
    const python = path.join(root, ".venv", "Scripts", "python.exe");
    await mkdir(path.dirname(python), { recursive: true });
    await writeFile(python, "fixture");
    await installSkillPackage({ requirement: { kind: "python", name: "pydantic", required: ">=2" }, project: root, platform: "win32", run: async (...args) => calls.push(args) });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], await (await import("node:fs/promises")).realpath(python));
    assert.deepEqual(calls[0][1], ["-m", "pip", "install", "--disable-pip-version-check", "--", "pydantic>=2"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("standalone npm tools use the managed prefix without writing a project manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "limix-cli-install-"));
  const calls = [];
  try {
    await installSkillPackage({ requirement: { kind: "npm", name: "agent-desktop", installScope: "tool" }, project: root, node: "node", npmCli: "npm-cli.js", run: async (...args) => calls.push(args) });
    assert.deepEqual(calls[0][1], ["npm-cli.js", "install", "--global", "--prefix", await (await import("node:fs/promises")).realpath(root), "--no-audit", "--no-fund", "--", "agent-desktop"]);
    await assert.rejects(readFile(path.join(root, "package.json")), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
