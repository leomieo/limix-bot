import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { splitMessage } from "../src/chunk.mjs";
import { PairingStore, RATE_LIMIT_MS, CODE_TTL_MS } from "../src/pairing.mjs";
import { SecretStore } from "../src/secrets.mjs";
import { redact } from "../src/util/redact.mjs";
import { readFileSync } from "node:fs";

const tmp = () => mkdtempSync(join(tmpdir(), "limix-"));

test("short text is one chunk", () => {
  assert.deepEqual(splitMessage("xin chào", 100), ["xin chào"]);
});

test("long text splits under the limit with markers", () => {
  const text = Array.from({ length: 200 }, (_, i) => `dòng ${i} nội dung`).join("\n");
  const parts = splitMessage(text, 500);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(p.length <= 500, `chunk ${p.length}`);
  assert.match(parts[0], /\(1\/\d+\)$/);
});

test("a split inside a code fence closes and reopens it", () => {
  const text = "Mã:\n```js\n" + Array.from({ length: 80 }, (_, i) => `const a${i} = ${i};`).join("\n") + "\n```\nHết.";
  const parts = splitMessage(text, 400);
  for (const p of parts) {
    const fences = (p.match(/```/g) ?? []).length;
    assert.equal(fences % 2, 0, `unbalanced fence in: ${p.slice(0, 40)}`);
  }
  assert.ok(parts[1].startsWith("```js\n"));
});

test("pairing: code, rate limit, pending cap, approval, wrong-code lockout", () => {
  let t = 1_000_000;
  const store = new PairingStore(tmp(), () => t);
  const a = store.request("c1", "u1", "An");
  assert.match(a.code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(store.request("c1", "u1", "An").refused, "already_pending");
  store.request("c1", "u2", "Bình");
  store.request("c1", "u3", "Chi");
  assert.equal(store.request("c1", "u4", "Dũng").refused, "too_many_pending");
  assert.equal(store.approve("c2", a.code).error, "invalid_code", "a code only works for its own connection");
  assert.equal(store.approve("c1", a.code).approved.senderId, "u1");
  assert.equal(store.approve("c1", a.code).error, "invalid_code", "a code is single use");
  for (let i = 0; i < 5; i++) store.approve("c1", "WRONGCOD");
  assert.equal(store.approve("c1", "ANYTHING").error, "locked_out");
  t += CODE_TTL_MS + 1;
  assert.equal(store.list("c1").length, 0, "codes expire");
  assert.equal(store.request("c1", "u1", "An").code !== undefined, true);
  assert.equal(store.request("c1", "u1", "An").refused, "already_pending");
  assert.ok(RATE_LIMIT_MS > 0);
  const raw = readFileSync(store.file, "utf8");
  assert.ok(!raw.includes(a.code), "plain codes are never stored");
});

test("secrets are encrypted at rest and round-trip", () => {
  const dir = tmp();
  const s = new SecretStore(dir);
  const ref = s.put("123456:SECRETTOKENVALUEabcdefghij");
  assert.equal(s.get(ref), "123456:SECRETTOKENVALUEabcdefghij");
  assert.ok(!readFileSync(join(dir, "secrets.json"), "utf8").includes("SECRETTOKENVALUE"));
  assert.equal(new SecretStore(dir).get(ref), "123456:SECRETTOKENVALUEabcdefghij");
});

test("redaction hides bot tokens, API keys and bearer values", () => {
  const out = redact("GET https://api.telegram.org/bot123456:AAAAAAAAAAAAAAAAAAAAAAAAAAA/getMe key bak_abcdefghijklmnopqrstuvwxyz Bearer xyz12345678");
  assert.ok(!out.includes("AAAAAAAA"));
  assert.ok(!out.includes("abcdefghijklmnop"));
  assert.ok(!out.includes("xyz12345678"));
  assert.equal(redact("/hooks/api/bots/bot1/messages"), "/hooks/api/bots/bot1/messages");
});
