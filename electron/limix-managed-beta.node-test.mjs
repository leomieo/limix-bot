import { test } from "node:test";
import assert from "node:assert/strict";
import { openManagedHome } from "./limix-managed-beta.mjs";

const origin = "https://lc-" + "a".repeat(32) + ".limixmedia.com";

test("carries the account's grant to its own home and returns the pairing credential", async () => {
  const calls = [];
  const send = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/workspace/open")) return Response.json({ state: "running", origin, grant: "payload.signature" });
    return Response.json({ credential: "omb_pair_fixture" });
  };
  assert.deepEqual(await openManagedHome({ bearer: "limix.x.y" }, send), { ok: true, origin, credential: "omb_pair_fixture" });
  assert.equal(calls[0].init.headers.authorization, "Bearer limix.x.y");
  assert.equal(calls[1].url, origin + "/api/limix/managed/grant");
  assert.equal(calls[1].init.headers.authorization, undefined, "the Limix sign-in never reaches the home");
  assert.deepEqual(JSON.parse(calls[1].init.body), { grant: "payload.signature" });
});

test("reports a home that is not ready and refuses an address outside Limix Cloud", async () => {
  assert.deepEqual(await openManagedHome({ bearer: "b" }, async () => Response.json({ state: "routing" }, { status: 409 })), { ok: false, state: "routing" });
  assert.deepEqual(await openManagedHome(null, assert.fail), { ok: false, state: "hidden" });
  await assert.rejects(openManagedHome({ bearer: "b" }, async () => Response.json({ origin: "https://evil.example", grant: "g" })), /temporarily unavailable/);
});
