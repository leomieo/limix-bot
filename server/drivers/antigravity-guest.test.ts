import { expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { removeTempDir } from "../testing/cleanup.ts";
import type { ProviderAdapter, RuntimeEvent } from "../contracts.ts";
import { antigravityGuestAdapter } from "./antigravity-guest.ts";

it("runs both selected models on the same customer thread with strict tool permissions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "limix-guest-test-"));
  const cli = join(dir, "engine.cjs");
  writeFileSync(cli, `console.log(JSON.stringify({event:"init",init:{permission_mode:"strict"}})); let data = ""; process.stdin.on("data", c => data += c); process.stdin.on("end", () => {
    const arg = key => process.argv[process.argv.indexOf(key) + 1];
    if (JSON.parse(arg("--settings")).toolPermission !== "strict" || !process.argv.includes("--sandbox")) process.exit(2);
    const response = arg("--model") + " " + JSON.parse(data).message.content;
    console.log(JSON.stringify({ event:"result", result:{status:"SUCCESS",response:arg("--model")==="image-model"?[{type:"image",mimeType:"image/png",data:"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a73sAAAAASUVORK5CYII="}]:response} }));
  });`);
  const base = { provider: "antigravityAgent", capabilities: {}, onEvent: () => () => {}, stopAll: async () => {} } as unknown as ProviderAdapter;
  const adapter = antigravityGuestAdapter(base, `"${process.execPath}" "${cli}"`, process.env);
  const events: RuntimeEvent[] = [];
  const off = adapter.onEvent(event => events.push(event));
  try {
    for (const model of ["model-a", "model-b"]) {
      const { turnId } = await adapter.sendTurn({ guestConfined: true, threadId: "customer-a", text: "Hello", model });
      await expect.poll(() => events.find(event => event.turnId === turnId && event.type === "turn.completed")).toMatchObject({ ok: true });
      expect(events).toContainEqual(expect.objectContaining({ turnId, type: "item.completed", text: model + " Hello" }));
    }
    const { turnId } = await adapter.sendTurn({ guestConfined: true, threadId: "customer-a", text: "Draw a cat", model: "image-model" });
    await expect.poll(() => events.find(event => event.turnId === turnId && event.type === "turn.completed")).toMatchObject({ ok: true });
    expect(events).toContainEqual(expect.objectContaining({ turnId, itemType: "assistant_image", data: expect.stringMatching(/^iVBOR/) }));
  } finally { off(); await adapter.stopAll(); await removeTempDir(dir); }
});
