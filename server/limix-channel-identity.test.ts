import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ChannelIdentityRegistry, channelScope, parseChannelHeader, type ChannelConversation } from "./limix-channel-identity.ts";

it("persists platform/user bindings and rejects another sender, platform or owner lane", () => {
  const dir = mkdtempSync(join(tmpdir(), "limix-identity-"));
  try {
    const file = join(dir, "identities.json");
    const registry = new ChannelIdentityRegistry(file);
    const identity: ChannelConversation = { connectionId: "one", platform: "zalo", kind: "private", chatId: "chat", senderId: "alice" };
    registry.bind("thread", identity, false);
    expect(new ChannelIdentityRegistry(file).matches("thread", identity, false)).toBe(true);
    expect(registry.matches("thread", { ...identity, senderId: "bob" }, false)).toBe(false);
    expect(registry.matches("thread", { ...identity, platform: "telegram" }, false)).toBe(false);
    expect(registry.matches("thread", identity, true)).toBe(false);
    expect(registry.matches("thread", undefined, false)).toBe(false);
    expect(() => registry.bind("thread", { ...identity, senderId: "bob" }, false)).toThrow();
    expect(registry.matches("legacy", undefined, false)).toBe(true);
    expect(registry.matches("legacy", identity, false)).toBe(false);
    expect(parseChannelHeader(Buffer.from(JSON.stringify(identity)).toString("base64url"))).toEqual(identity);
    expect(() => parseChannelHeader("invalid!!")).toThrow();
    expect(channelScope(identity, false)).not.toBe(channelScope({ ...identity, chatId: "chat|alice" }, false));
    writeFileSync(file, "corrupt");
    expect(() => new ChannelIdentityRegistry(file)).toThrow();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
