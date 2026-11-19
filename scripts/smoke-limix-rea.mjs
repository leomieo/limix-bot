import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { launchVerificationServer, runControlOmb } from "./control-omb.ts";

const resources = resolve(process.argv[2] ?? "release/win-unpacked/resources");
const require = createRequire(import.meta.url);
const builder = createRequire(require.resolve("electron-builder"));
const asar = createRequire(builder.resolve("app-builder-lib"))("@electron/asar");
const archive = join(resources, "app.asar");
const server = join(resources, "server", "index.js");
assert(existsSync(server), "The packaged server is missing");
const scratch = mkdtempSync(join(tmpdir(), "limix-packaged-rea-"));
Object.assign(process.env, {
  HOME: scratch, USERPROFILE: scratch, APPDATA: join(scratch, "Roaming"), LOCALAPPDATA: join(scratch, "Local"),
});
let fixture;
try {
  for (const filename of [
    "limix-tools.mjs", "limix-docker-mac.mjs", "limix-runtime.mjs", "limix-lang.mjs", "limix-skill-install.mjs",
  ]) writeFileSync(join(scratch, filename), asar.extractFile(archive, `electron/${filename}`));
  const { createLimixTools } = await import(pathToFileURL(join(scratch, "limix-tools.mjs")).href);
  const sampleDir = join(scratch, "sample");
  const sample = join(scratch, "limix-rea-fixture.asar");
  mkdirSync(sampleDir);
  writeFileSync(join(sampleDir, "fixture.js"), 'export const label = "Limix fixture";\n');
  await asar.createPackage(sampleDir, sample);
  fixture = await launchVerificationServer({
    ...process.env,
    FAKE_CLAUDE_MCP_STDIO_HANDSHAKE: "1",
    FAKE_CLAUDE_TOOL_CALLS: JSON.stringify([{ name: "open_binary", server: "rea", input: { path: sample } }]),
  }, undefined, undefined, undefined, undefined, undefined, [], undefined, undefined, server);
  const serverRequest = (path, options) => fetch(fixture.info.url + path, options);
  const api = async (path, body, method = "GET") => {
    const response = await serverRequest(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
      signal: AbortSignal.timeout(30_000),
    });
    assert(response.ok, `${method} ${path} returned ${response.status}: ${await response.clone().text()}`);
    return response.json();
  };
  const installer = createLimixTools({ userData: scratch, resourcesPath: resources, serverRequest });
  await installer.install("rea");
  const deadline = Date.now() + 300_000;
  for (;;) {
    const item = (await installer.state()).items.find(({ id }) => id === "rea");
    if (item.installed) break;
    assert(item.job?.status !== "error", item.job?.message);
    assert(Date.now() < deadline, "Timed out installing REA");
    await delay(500);
  }
  const { servers } = await api("/api/mcp/servers");
  assert.equal(servers.find(({ name }) => name === "rea")?.enabled, false);
  await api("/api/mcp/servers/rea", { enabled: true }, "PATCH");
  const probe = await api("/api/mcp/servers/rea/test", undefined, "POST");
  assert.equal(probe.ok, true, JSON.stringify(probe));
  assert(probe.tools.length > 0, "REA did not advertise MCP tools");
  const control = (args) => runControlOmb([...args, "--url", fixture.info.url]);
  const { bot } = await control(["new-bot", "--name", "REA fixture"]);
  await api(`/api/bots/${bot.id}`, { mcpServers: ["rea"] }, "PATCH");
  await control(["send", "--bot", bot.id, "--text", "Inspect the local fixture archive."]);
  assert.equal((await control(["wait", "--bot", bot.id, "--timeout", "75"])).status, "settled");
  const { messages } = await control(["messages", bot.id, "--limit", "20"]);
  const activity = messages.find((message) => message.tool?.name === "open_binary");
  assert.equal(activity?.tool.ok, true, JSON.stringify(activity ?? messages));
  console.log("PASS: packaged Windows installer code installed REA, and a fixture bot opened a local sample through REA MCP.");
} finally {
  await fixture?.close();
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
