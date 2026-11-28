import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { launchVerificationServer, verificationServerArgs, verificationServerEnvironment } from "../scripts/control-omb.ts";
import { INDUSTRY_CARE_SKILL } from "../shared/industry-templates.ts";

it("delivers once when the recipient received the message but its acknowledgement was lost across restart", async () => {
  const recipient = "ci-support-recipient";
  const sku = "CI-24";
  const receiptBook: string[] = [];
  const settings = { FAKE_CLAUDE_VERSION: "2.1.284", FAKE_CLAUDE_TOOL_CALLS: "[]", FAKE_CLAUDE_REPLIES: JSON.stringify(["CI-24: 123000 VND"]) };
  const fixture = await launchVerificationServer(settings);
  const { url, dataDir } = fixture.info;
  const api = async (path: string, body?: unknown) => {
    const response = await fetch(url + path, { method: body === undefined ? "GET" : "POST",
      headers: { origin: url, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(path + ": HTTP " + response.status);
    return response.json();
  };
  let reboot: ReturnType<typeof spawn> | undefined;
  try {
    const { bot } = await api("/api/bots", { industryTemplate: INDUSTRY_CARE_SKILL });
    const dir = join(dataDir, INDUSTRY_CARE_SKILL, bot.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "public-catalog.json"), JSON.stringify({ schemaVersion: 1, scope: bot.id, records: [{
      status: "approved", visibility: "public", sku, name: "CI product", priceMinor: 123000, currency: "VND", availability: "in_stock",
      source: "runner-only price list", asOf: new Date(Date.now() - 60000).toISOString(), validUntil: new Date(Date.now() + 3600000).toISOString(),
    }] }));
    const route = "/api/bots/" + bot.id + "/messenger";
    await api(route, { token: JSON.stringify({ uid: "100045", name: "CI" }), access: "everyone" });
    const ready = () => expect.poll(async () => { try { return (await api("/api/messenger/bots")).bots; } catch { return []; } }, { timeout: 30000 }).toContain(bot.id);
    await ready();
    const event = { messages: [{ id: "ci-replay-001", chatId: recipient, name: "CI recipient", text: "Giá bán SKU CI-24?" }] };
    await api(route + "/inbox", event);
    const receive = async () => {
      const { items } = await api(route + "/outbox");
      for (const item of items) {
        expect(item.chatId).toBe(recipient);
        receiptBook.push(item.text);
      }
      return items;
    };
    const first = await receive();
    expect(first).toHaveLength(1);
    expect(JSON.parse(readFileSync(fixture.fixtureDumpPath, "utf8")).prompt).toContain("runner-only price list");
    const stopped = once(fixture.child, "exit");
    fixture.child.kill("SIGKILL");
    await stopped;
    const env = verificationServerEnvironment(settings, dataDir, Number(new URL(url).port));
    reboot = spawn(process.execPath, verificationServerArgs(env), { env, stdio: "ignore" });
    await ready();
    await api(route + "/inbox", event);
    const replay = await receive();
    for (const item of replay) await api(route + "/sent", { id: item.id });
    expect(receiptBook, "physical deliveries to the same test recipient").toHaveLength(1);
  } finally {
    if (reboot && reboot.exitCode === null && reboot.signalCode === null) {
      const stopped = once(reboot, "exit");
      reboot.kill("SIGKILL");
      await stopped;
    }
    await fixture.close();
  }
}, 150000);
