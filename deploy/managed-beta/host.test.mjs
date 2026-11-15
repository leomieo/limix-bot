import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { reconcile } from "./host.mjs";

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
