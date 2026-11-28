import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { launchVerificationServer, runControlOmb } from "./control-omb.ts";
import { openSse } from "../server/testing/sse.ts";
import { limixNativeResource } from "../server/limix-native-path.ts";

const { values } = parseArgs({ options: { resources: { type: "string" } } });
const resources = values.resources && resolve(values.resources);
const name = process.platform === "win32" ? "limix-process-sampler.exe" : "limix-process-sampler";
const sampler = resources ? join(resources, "limix-native", name) : limixNativeResource(name);
assert.ok(existsSync(sampler), "Build the native resources before running this fixture.");

const release = join(tmpdir(), `limix-sampler-release-${randomUUID()}`);
const prompt = "Run the fixture network check.";
const reply = "Fixture network check completed.";
const env = {
  SystemRoot: process.env.SystemRoot,
  ComSpec: process.env.ComSpec,
  PATHEXT: process.env.PATHEXT,
  LIMIX_ACP_PROCESS_SAMPLER: "rust",
  OMB_ACP_QUIET_NOTICE_MS: "500",
  OMB_ACP_QUIET_TICK_MS: "250",
  FAKE_CLAUDE_RELEASE: release,
  FAKE_CLAUDE_REPLIES: JSON.stringify([reply]),
  FAKE_CLAUDE_TOOL_CALLS: JSON.stringify([{ name: "Bash", input: { command: "node fixture-network.js" }, hold: "network" }]),
};
const fixture = resources
  ? await launchVerificationServer(env, undefined, undefined, undefined, undefined, undefined, [], undefined, undefined, join(resources, "server", "index.js"))
  : await launchVerificationServer(env);
const { url, logPath } = fixture.info;
const control = (...args) => runControlOmb([...args, "--url", url]);
let stream;
try {
  stream = await openSse(`${url}/api/events`, { origin: url });
  const { bot } = await control("new-bot", "--name", "Sampler");
  const target = ["--bot", bot.id, "--task", bot.activeTaskId];
  const send = await control("send", ...target, "--text", prompt);
  assert.equal(send.success, true);
  const { event } = await stream.until(({ kind, event }) => kind === "runtime" && event?.threadId === bot.activeTaskId
    && event.type === "turn.progress" && event.activity === "command" && event.quiet?.kind === "network", 20_000);
  writeFileSync(release, "go", { flag: "wx" });
  const wait = await control("wait", ...target, "--timeout", "30");
  assert.equal(wait.status, "settled");
  const messages = await control("messages", ...target, "--limit", "12");
  assert.ok(messages.messages.some(row => row.role === "user" && row.text === prompt));
  assert.ok(messages.messages.some(row => row.role === "bot" && row.text === reply));
  const evidence = { logPath, sampler, send, progress: event, wait, messages };
  const path = `${logPath}.process-sampler.json`;
  writeFileSync(path, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ path, logPath, activity: event.activity, target: event.target, quiet: event.quiet, wait: wait.status, reply }));
} finally {
  if (!existsSync(release)) writeFileSync(release, "go", { flag: "wx" });
  stream?.close();
  await fixture.close();
  rmSync(release, { force: true });
}
