import assert from "node:assert/strict";
import { test } from "node:test";

import { ZaloChannel } from "../src/channels/zalo.mjs";

const stub = (map) => async (url) => {
  const method = String(url).split("/").pop();
  const hit = map[method] ?? { status: 404, body: { ok: false, error_code: 404, description: "Not Found" } };
  return new Response(JSON.stringify(hit.body), { status: hit.status });
};

test("Zalo: getWebhookInfo 404 (no webhook set) is not a conflict and not an error", async () => {
  const ch = new ZaloChannel({ token: "t", fetchImpl: stub({}) });
  assert.deepEqual(await ch.checkConflict(), { conflict: false });
});

test("Zalo: a webhook that exists is still a conflict", async () => {
  const ch = new ZaloChannel({ token: "t", fetchImpl: stub({ getWebhookInfo: { status: 200, body: { ok: true, result: { url: "https://x.example/h" } } } }) });
  assert.equal((await ch.checkConflict()).conflict, true);
});

test("Zalo: other 404s name the method that failed", async () => {
  const ch = new ZaloChannel({ token: "t", fetchImpl: stub({}) });
  await assert.rejects(ch.sendText("1", "hi"), /Zalo lỗi 404 \(sendMessage\)/);
});
