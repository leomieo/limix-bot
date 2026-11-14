import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { test } from "node:test";
import { OpenMausBotEngine } from "../src/engines/openmausbot.mjs";

const endpoint = "http://127.0.0.1:8800/hooks/api/bots/b1/messages";
const response = (body, status = 200) => Response.json(body, { status });
const busy = (code = "capacity_busy") => response({ error: "busy", code, retryable: true }, 409);
const engineFor = (fetchImpl, extra = {}) => new OpenMausBotEngine({ endpoint, apiKey: "fixture-key", pollMs: 1, maxWaitMs: 1000, fetchImpl, ...extra });

test("waits on explicit pre-admission busy and preserves the customer's thread, media and channel", async () => {
  const calls = [];
  const engine = engineFor(async (_url, init) => {
    calls.push(init);
    return calls.length < 3 ? busy(calls.length === 1 ? "capacity_busy" : "thread_busy") : response({ reply: "hello", thread: "customer-1" });
  }, { ownerLaneToken: "owner-secret" });
  const attachments = [{ name: "cat.png", mime: "image/png", dataBase64: "YQ==" }];
  const answer = await engine.send({ message: "hi", thread: "customer-1", attachments, channel: "zalo", owner: true });
  assert.equal(answer.reply, "hello");
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.method, "POST");
    assert.deepEqual(JSON.parse(call.body), { message: "hi", thread: "customer-1", wait: 50, attachments, channel: "zalo" });
    assert.equal(call.headers["X-Limix-Owner"], "owner-secret");
  }
});

test("does not replay legacy, unmarked, unknown or post-admission conflicts", async () => {
  for (const body of [{ error: "busy" }, { code: "capacity_busy" }, { code: "thread_busy", retryable: false }, { code: "dispatch_error", retryable: true }]) {
    let calls = 0;
    const engine = engineFor(async () => { calls++; return response(body, 409); });
    await assert.rejects(engine.send({ message: "hi" }), (error) => error.code === "busy");
    assert.equal(calls, 1);
  }
});

test("does not retry ambiguous POST network failures across loopback ports", async () => {
  let calls = 0;
  const engine = engineFor(async () => { calls++; throw new TypeError("reset", { cause: { code: "ECONNRESET" } }); });
  await assert.rejects(engine.send({ message: "hi" }), (error) => error.code === "engine_unreachable");
  assert.equal(calls, 1);
});

test("does not replay a successful POST whose response body cannot be read", async () => {
  let calls = 0;
  const engine = engineFor(async () => { calls++; return new Response("broken json", { status: 200 }); });
  await assert.rejects(engine.send({ message: "hi" }), (error) => error.code === "engine_error");
  assert.equal(calls, 1);
});

test("aborts an in-flight POST without trying another endpoint", async () => {
  const controller = new AbortController();
  let calls = 0;
  const engine = engineFor(async (_url, init) => {
    calls++;
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      controller.abort();
    });
  });
  await assert.rejects(engine.send({ message: "hi", signal: controller.signal }), (error) => error.code === "aborted");
  assert.equal(calls, 1);
});

test("retains discovery on confirmed connection refusal only", async () => {
  const urls = [];
  const engine = engineFor(async (url) => {
    urls.push(String(url));
    if (urls.length === 1) throw new TypeError("refused", { cause: { code: "ECONNREFUSED" } });
    return response({ reply: "ok", thread: "customer-1" });
  });
  await engine.send({ message: "hi" });
  assert.equal(urls.length, 2);
  assert.equal(new URL(urls[1]).port, "18800");
});

test("saves the accepted thread before polling, without retrying POST after a poll failure", async () => {
  const methods = [];
  const saved = [];
  const engine = engineFor(async (_url, init) => {
    methods.push(init.method);
    if (init.method === "POST") return response({ status: "working", thread: "accepted-1" }, 202);
    assert.deepEqual(saved, ["accepted-1"]);
    return response({ error: "failed" }, 502);
  });
  await assert.rejects(engine.send({ message: "hi", onThread: (thread) => saved.push(thread) }), (error) => error.code === "engine_failed");
  assert.deepEqual(methods, ["POST", "GET"]);
});

test("rebuilds only a missing thread, keeping media and channel on the replacement", async () => {
  const bodies = [];
  const engine = engineFor(async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return bodies.length === 1 ? response({}, 404) : response({ reply: "ok", thread: "new-1" });
  });
  await engine.send({ message: "hi", thread: "removed-1", attachments: [{ name: "a.png" }], channel: "telegram" });
  assert.deepEqual(bodies[1], { message: "hi", attachments: [{ name: "a.png" }], wait: 50, channel: "telegram" });
});

test("bounds busy waiting and returns the non-accepted busy error at the deadline", async () => {
  let calls = 0;
  const engine = engineFor(async () => { calls++; return busy(); }, { maxWaitMs: 10 });
  await assert.rejects(engine.send({ message: "hi" }), (error) => error.code === "busy");
  assert.ok(calls >= 1 && calls <= 20);
});

test("an aborted wait sends nothing more and removes its abort listener", async () => {
  const controller = new AbortController();
  let calls = 0;
  const engine = engineFor(async () => { calls++; setTimeout(() => controller.abort(), 1); return busy(); }, { pollMs: 50 });
  await assert.rejects(engine.send({ message: "hi", signal: controller.signal }), (error) => error.code === "aborted");
  assert.equal(calls, 1);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  await assert.rejects(engine.send({ message: "hi", signal: controller.signal }), (error) => error.code === "aborted");
  assert.equal(calls, 1);
});

test("successful busy/poll waits remove abort listeners and never resend an accepted message", async () => {
  const controller = new AbortController();
  const methods = [];
  const engine = engineFor(async (_url, init) => {
    methods.push(init.method);
    if (methods.length === 1) return busy();
    return methods.length < 4 ? response({ thread: "accepted-1", status: "working" }, 202) : response({ thread: "accepted-1", reply: "ok" });
  });
  assert.equal((await engine.send({ message: "hi", signal: controller.signal })).reply, "ok");
  assert.deepEqual(methods, ["POST", "POST", "GET", "GET"]);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});
