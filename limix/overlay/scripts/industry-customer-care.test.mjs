import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { lookupPublicCatalog, prepareCase, triageTicket } from "../skills/industry-customer-care/scripts/care.mjs";
import profiles from "../skills/industry-customer-care/assets/industry-profiles.json" with { type: "json" };

const cli = fileURLToPath(new URL("../skills/industry-customer-care/scripts/care.mjs", import.meta.url));
const now = Date.parse("2026-01-10T12:00:00Z");
const input = { sku: "SP-100" };
const item = {
  ...input, visibility: "public", status: "approved", priceMinor: 159000, currency: "VND",
  availability: "in_stock", name: "Bình nước xanh", source: "Danh mục thử",
  asOf: "2026-01-01T00:00:00Z", validUntil: "2026-02-01T00:00:00.000Z",
};

async function fixture(t) {
  const catalogDir = await mkdtemp(join(tmpdir(), "limix-care-test-"));
  t.after(() => rm(catalogDir, { recursive: true, force: true }));
  const scope = "bot-A";
  return {
    binding: { catalogDir, scope },
    save: (records, overrides) => writeFile(join(catalogDir, "public-catalog.json"),
      JSON.stringify({ scope, schemaVersion: 1, records, ...overrides })),
  };
}

function invoke(args, data) {
  return spawnSync(process.execPath, [cli, ...args], { input: data, encoding: "utf8", timeout: 5000 });
}

test("prepare a department-specific draft for every industry and reject a role outside that industry", () => {
  assert.equal(new Set(profiles.map(profile => profile.slug)).size, 10);
  const workflows = new Set();
  for (const profile of profiles) {
    assert.equal(new Set(profile.roles.map(role => role.slug)).size, 3);
    for (const role of profile.roles) {
      const result = prepareCase({ industry: profile.slug, role: role.slug, caseRef: "CASE-15" });
      assert.deepEqual(result, {
        status: "draft", industry: profile.slug, role: role.slug, department: role.name,
        inputs: role.inputs, instructions: role.instructions, handoff: role.handoff, caseRef: "CASE-15",
      });
      assert.ok(result.handoff && result.inputs && result.instructions);
      workflows.add(result.instructions);
    }
  }
  assert.equal(workflows.size, 30);
  for (const args of [
    { industry: "retail-ecommerce", role: "table-desk" },
    { industry: "other", role: "returns-desk" },
    { industry: "retail-ecommerce", role: "returns-desk", phone: "private-field" },
    { industry: "retail-ecommerce", role: "returns-desk", caseRef: "visible customer details" },
  ]) assert.throws(() => prepareCase(args), TypeError);
});

test("route common support requests without repeating customer data or claiming a handoff", () => {
  const cases = [
    ["KHIẾU NẠI", "supervisor", "offer_human_handoff"],
    ["xin hoàn tiền về thẻ", "finance", "handoff_for_authorized_review"],
    ["hủy đơn hàng 19382", "operations", "verify_customer_in_private"],
    ["chính sách bảo hành", "support", "consult_published_policy"],
    ["giá bao nhiêu?", "sales", "ask_for_sku_or_use_public_lookup"],
    ["xin chào", "support", "ask_one_clarifying_question"],
  ];
  for (const [text, queue, next] of cases) {
    assert.deepEqual(triageTicket({ text, channel: "messenger" }), { status: "suggested", queue, next });
  }
  for (const args of [{ text: "x".repeat(2001) }, { text: "" }, { text: "hi", channel: "unknown" }, { text: "hi", bot: "B" }]) {
    assert.throws(() => triageTicket(args), TypeError);
  }
});

test("allowlist returned fields and require a single fresh public approved record under the bot scope", async (t) => {
  const { binding, save } = await fixture(t);
  const lookup = () => lookupPublicCatalog(input, binding, now);
  assert.deepEqual(await lookup(), { status: "not_configured" });
  assert.deepEqual(await lookupPublicCatalog(input), { status: "not_configured" });
  await save([{ ...item, customerPhone: "private", internalMargin: 25 }]);
  const { visibility: _visibility, status: _status, ...expected } = item;
  assert.deepEqual(await lookup(), { ...expected, status: "found" });
  assert.deepEqual(await lookupPublicCatalog(input, { ...binding, scope: "bot-B" }, now), { status: "unavailable" });
  for (const changes of [{ visibility: "private" }, { status: "draft" }, { validUntil: "2026-01-10T12:00:00Z" },
    { asOf: "2026-01-11T00:00:00Z" }, { asOf: "2025-02-30T00:00:00Z" }]) {
    await save([{ ...item, ...changes }]);
    assert.deepEqual(await lookup(), { status: "no_current_record" });
  }
  for (const rows of [[item, item], [{ ...item, priceMinor: -1 }], [{ ...item, currency: "" }]]) {
    await save(rows);
    assert.deepEqual(await lookup(), { status: "unavailable" });
  }
  await save([item], { schemaVersion: 2 });
  assert.deepEqual(await lookup(), { status: "unavailable" });
  await assert.rejects(lookupPublicCatalog({ ...input, scope: "bot-B" }, binding), TypeError);
  await assert.rejects(lookupPublicCatalog({ sku: "A\nB" }, binding), TypeError);
});

test("CLI uses only host options for scope and reports malformed input without printing the request", async (t) => {
  const { binding, save } = await fixture(t);
  await save([{ ...item, asOf: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000) }]);
  const args = ["lookup", "--scope", binding.scope, "--catalog-dir", binding.catalogDir];
  const success = invoke(args, JSON.stringify(input));
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).status, "found");
  const failure = invoke(args, '{"sku":"SP-100","scope":"SHOULD_NEVER_APPEAR"}');
  assert.equal(failure.status, 1);
  assert.doesNotMatch(failure.stdout + failure.stderr, /SHOULD_NEVER_APPEAR/);
  assert.equal(JSON.parse(invoke(["triage"], '{"text":"my order"}').stdout).queue, "operations");
  const department = { industry: "retail-ecommerce", role: "returns-desk" };
  assert.deepEqual(JSON.parse(invoke(["prepare"], JSON.stringify(department)).stdout), prepareCase(department));
});

test("MCP stdio negotiates, lists the three read-only tools and rejects changed bindings and invalid roles", async (t) => {
  const { binding, save } = await fixture(t);
  await save([{ ...item, asOf: new Date(Date.now() - 60_000), validUntil: new Date(Date.now() + 60_000) }]);
  const rpc = (id, method, params) => JSON.stringify({ jsonrpc: "2.0", id, method, params });
  const frames = [
    rpc(0, "tools/list"), rpc(1, "initialize", { protocolVersion: "2024-11-05" }),
    rpc(undefined, "notifications/initialized"), rpc(2, "tools/list"),
    rpc(3, "tools/call", { name: "care_triage", arguments: { text: "chargeback", channel: "facebook" } }),
    rpc(4, "tools/call", { name: "care_lookup", arguments: input }),
    rpc(5, "tools/call", { name: "care_lookup", arguments: { ...input, catalogDir: "another" } }),
    rpc(6, "tools/call", { name: "refund", arguments: {} }), "x".repeat(33000), rpc(7, "ping"),
    rpc(8, "tools/call", { name: "care_prepare_case", arguments: { industry: "retail-ecommerce", role: "returns-desk" } }),
    rpc(9, "tools/call", { name: "care_prepare_case", arguments: { industry: "retail-ecommerce", role: "table-desk" } }),
  ];
  const proc = invoke(["mcp", "--scope", binding.scope, "--catalog-dir", binding.catalogDir], frames.join("\n") + "\n");
  assert.equal(proc.status, 0, proc.stderr);
  const [early, init, list, triage, lookup, denied, unknown, large, ping, draft, invalidRole] = proc.stdout.trimEnd().split("\n").map(JSON.parse);
  assert.equal(early.error.code, -32002);
  assert.equal(init.result.protocolVersion, "2024-11-05");
  assert.deepEqual(list.result.tools.map((tool) => tool.name), ["care_triage", "care_lookup", "care_prepare_case"]);
  assert.ok(list.result.tools.every((tool) => tool.annotations.readOnlyHint && !tool.inputSchema.additionalProperties));
  assert.equal(JSON.parse(triage.result.content[0].text).queue, "finance");
  assert.equal(JSON.parse(lookup.result.content[0].text).status, "found");
  assert.equal(denied.result.isError, true);
  assert.equal(unknown.error.code, -32602);
  assert.equal(large.error.code, -32600);
  assert.deepEqual(ping.result, {});
  assert.deepEqual(JSON.parse(draft.result.content[0].text), prepareCase({ industry: "retail-ecommerce", role: "returns-desk" }));
  assert.equal(invalidRole.result.isError, true);
});
