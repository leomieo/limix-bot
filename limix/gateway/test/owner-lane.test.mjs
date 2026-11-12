import assert from "node:assert/strict";
import { test } from "node:test";

import { OpenMausBotEngine } from "../src/engines/openmausbot.mjs";

const ENDPOINT = "http://127.0.0.1:8800/hooks/api/bots/b1/messages";

test("owner calls carry the owner-lane secret, guest calls never do", async () => {
  const seen = [];
  const fetchImpl = async (_url, init) => {
    seen.push(init.headers["X-Limix-Owner"]);
    return new Response(JSON.stringify({ reply: "ok", thread: "t1" }), { status: 200 });
  };
  const engine = new OpenMausBotEngine({ endpoint: ENDPOINT, apiKey: "bak_x", fetchImpl, ownerLaneToken: "secret" });
  await engine.send({ message: "hi", owner: true });
  await engine.send({ message: "hi" });
  assert.deepEqual(seen, ["secret", undefined]);
});

test("a 403 names which refusal it is", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: "This bot's AI can't take Bot API calls. Choose another AI for this bot." }), { status: 403 });
  const engine = new OpenMausBotEngine({ endpoint: ENDPOINT, apiKey: "bak_x", fetchImpl });
  await assert.rejects(engine.send({ message: "hi" }), (error) => error.code === "engine_unsupported");
});
