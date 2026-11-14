import assert from "node:assert/strict";
import { test } from "node:test";
import { macDockerDownload, macDockerLocations, openMacDockerInstaller } from "./limix-docker-mac.mjs";

test("Docker installers use official Apple Silicon and Intel URLs", () => {
  assert.equal(macDockerDownload("arm64"), "https://desktop.docker.com/mac/main/arm64/Docker.dmg");
  assert.equal(macDockerDownload("x64"), "https://desktop.docker.com/mac/main/amd64/Docker.dmg");
  assert.throws(() => macDockerDownload("ia32"));
  assert.ok(macDockerLocations("/Users/test").includes("/Applications/Docker.app/Contents/Resources/bin/docker"));
});
test("installer integrity is verified before opening and never reported as installed", async () => {
  const calls = [];
  await openMacDockerInstaller({ arch: "arm64", tools: "/fixture", download: async (id, url) => { calls.push([id, url]); return "/partial"; }, rename: async (...args) => calls.push(args), run: async (...args) => calls.push(args) });
  assert.equal(calls[2][0], "/usr/bin/hdiutil"); assert.equal(calls[2][1][0], "verify");
  assert.equal(calls[3][0], "/usr/bin/open");
});
test("failed verification prevents opening the DMG", async () => {
  const calls = [];
  await assert.rejects(openMacDockerInstaller({ arch: "x64", tools: "/fixture", download: async () => "/partial", rename: async () => {}, run: async (command) => { calls.push(command); throw new Error("invalid DMG"); } }));
  assert.deepEqual(calls, ["/usr/bin/hdiutil"]);
});
