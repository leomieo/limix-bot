import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ensureTunnel, grantPublicKey, reconcile, TUNNEL_CONTAINER } from "./host.mjs";

test("caps active homes, stops a revoked home, and never removes a volume", async () => {
  const [a, b, revoked] = Array.from({ length: 3 }, () => randomUUID());
  const calls = [], reports = [];
  await reconcile([a, b], 1, (...args) => reports.push(args), async args => {
    calls.push(args);
    if (args[0] === "ps") return "limix-home-" + revoked;
    if (args.includes("-q")) return "fixture";
    if (args[0] === "inspect") return "healthy";
    return "";
  });
  assert.deepEqual(reports, [[a, "running"], [b, "waiting_capacity"]]);
  assert(calls.some(args => args.includes("limix-home-" + revoked) && args.includes("stop")));
  assert(!calls.some(args => args.includes("down") || args.includes("-v")));
});

test("invalid registry snapshots cannot modify Docker", async () => {
  await assert.rejects(reconcile(["../other"], 1, assert.fail, assert.fail), /Invalid host/);
});

test("gives each home only its own address and the public grant key", async () => {
  const [a, b] = [randomUUID(), randomUUID()];
  const envs = new Map();
  const origins = { [a]: `https://lc-${a.replace(/-/g, "")}.limixmedia.com`, [b]: `https://lc-${a.replace(/-/g, "")}.limixmedia.com` };
  await reconcile([a, b], 2, () => {}, async (args, env) => {
    if (args[0] === "compose" && args.includes("up")) envs.set(args[args.indexOf("-p") + 1], env);
    return args[0] === "inspect" ? "healthy" : args.includes("-q") ? "fixture" : "";
  }, { origins, grantKey: "k".repeat(43) });
  assert.deepEqual(envs.get("limix-home-" + a), { LIMIX_HOME_ID: a, LIMIX_HOME_ORIGIN: origins[a], LIMIX_GRANT_PUBLIC_KEY: "k".repeat(43) });
  assert.deepEqual(envs.get("limix-home-" + b), { LIMIX_HOME_ID: b }, "an address naming another workspace is ignored");
});

test("starts the tunnel connector once with the token only in its environment", async () => {
  const calls = [];
  let state = "";
  const command = async (args, env) => {
    calls.push({ args, env });
    if (args[0] === "network" && args[1] === "ls") return "";
    if (args[0] === "ps") return state;
    if (args[0] === "run") state = "running";
    return "";
  };
  assert.equal(await ensureTunnel("fixture-connector-token-value", command), "created");
  const started = calls.find(call => call.args[0] === "run");
  assert(!started.args.includes("fixture-connector-token-value"));
  assert.deepEqual(started.env, { TUNNEL_TOKEN: "fixture-connector-token-value" });
  assert(started.args.includes(TUNNEL_CONTAINER) && started.args.includes("limix-managed-edge"));
  assert(calls.some(call => call.args.join(" ") === "network create limix-managed-edge"));
  assert.equal(await ensureTunnel("fixture-connector-token-value", command), "running");
  await assert.rejects(ensureTunnel("bad token", command), /Invalid tunnel token/);
});

test("derives a stable 32-byte public key from the host token", () => {
  const key = grantPublicKey("fixture-host-token-".repeat(3));
  assert.match(key, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(key, grantPublicKey("fixture-host-token-".repeat(3)));
  assert.notEqual(key, grantPublicKey("other-host-token-".repeat(3)));
});
