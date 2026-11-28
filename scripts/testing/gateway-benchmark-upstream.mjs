import assert from "node:assert/strict";
import { once } from "node:events";
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const textBlock = text => ({ type: "text", text });
const marker = id => "response-" + typeof id + "-" + id + "|";
const products = Array.from({ length: 2_048 }, (_, i) => ({ id: i, label: "Mẫu thử " + i + " 🌿".repeat(12) }));
const tools = ["read", "schema", "hidden", "write"].map(name => ({ name, inputSchema: { type: "object" },
  ...(name === "hidden" ? { _meta: { ui: { visibility: ["app"] } } } : {}),
  ...(name === "schema" ? { outputSchema: { type: "object" } } : {}),
}));

function resultFor(id, args) {
  const { bytes, shape } = args;
  assert.ok(Number.isInteger(bytes) && bytes >= 512 && bytes <= 4 * 1024 * 1024);
  const prefix = marker(id);
  switch (shape) {
    case "structured": {
      const value = { id, products };
      return { content: [textBlock(JSON.stringify(value))], structuredContent: { products, id } };
    }
    case "multi": {
      const second = "🙂 tiếng Việt\t".repeat(8_192);
      return { content: [textBlock(prefix + "a".repeat(bytes)), textBlock(second)], isError: true, _meta: { source: "fixture" } };
    }
    case "unicode":
      return { content: [textBlock(prefix + 'Gió\n🙂"\\\u0000'.repeat(Math.ceil(bytes / 8)))] };
    case "ascii":
    case "custom-wire":
      return { content: [textBlock(prefix + "x".repeat(bytes - prefix.length))] };
    default:
      throw new Error("Unknown fixture shape");
  }
}

const group = [];
for await (const line of createInterface({ input: process.stdin })) {
  const { id, method, params } = JSON.parse(line);
  if (method === "initialize") {
    const result = { protocolVersion: params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } };
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
    continue;
  }
  if (method === "notifications/initialized") continue;
  if (method === "tools/list") {
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result: { tools } }) + "\n");
    continue;
  }
  assert.equal(method, "tools/call");
  if (process.env.FIXTURE_CALLS) appendFileSync(process.env.FIXTURE_CALLS, JSON.stringify({ id, name: params.name }) + "\n");
  assert.ok(["read", "schema"].includes(params.name), "a withheld tool reached the upstream");
  group.push({ id, args: params.arguments });
  if (group.length < params.arguments.concurrency) continue;
  for (const entry of group.reverse()) {
    const result = resultFor(entry.id, entry.args);
    let frame = JSON.stringify({ jsonrpc: "2.0", id: entry.id, result });
    if (entry.args.shape === "custom-wire") {
      assert.equal(entry.id, 18);
      const text = JSON.stringify(result.content[0].text).replace("response-", "\\u0072esponse-");
      frame = '{ "result": { "content": [{ "text":' + text + ', "type":"text" }]}, "id":1.8e1, "jsonrpc":"2\\u002e0" }';
    }
    if (!process.stdout.write(frame + "\n")) await once(process.stdout, "drain");
  }
  group.length = 0;
}
assert.equal(group.length, 0);
