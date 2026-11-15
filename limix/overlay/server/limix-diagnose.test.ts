import { describe, expect, it } from "vitest";
import { diagnoseLimix } from "./limix-diagnose.ts";

const engines = [{ instanceId: "claude", displayName: "Claude", state: "available" }];
const bots = [{ id: "b1", name: "Assistant" }];

describe("diagnoseLimix", () => {
  it("finds a refused Telegram token and a conflicting Zalo bot, with a fix for each, and no secrets", () => {
    const result = diagnoseLimix({ engines, bots, channels: [
      { id: "1", platform: "telegram", name: "Shop", status: "credential_invalid", statusDetail: "401 Unauthorized", running: false },
      { id: "2", platform: "zalo", status: "conflict", statusDetail: "webhook set elsewhere" },
      { id: "3", platform: "discord", status: "running" },
    ] });
    expect(result.ok).toBe(false);
    expect(result.findings.map((finding) => finding.subject)).toEqual(["Telegram · Shop", "Zalo"]);
    expect(result.findings[0]!.fix).toMatch(/fresh token/);
    expect(result.findings[1]!.fix).toMatch(/webhook/);
    expect(JSON.stringify(result)).not.toMatch(/token":/);
  });

  it("says so when the connector can't be read, and flags a signed-out engine or an empty workspace", () => {
    const result = diagnoseLimix({ engines: [{ instanceId: "codex", displayName: "Codex", state: "unavailable", reason: "not signed in" }], bots: [], channels: null });
    expect(result.notes[0]).toMatch(/can't be read from here/);
    expect(result.findings.map((finding) => finding.area)).toEqual(["engine", "setup"]);
    expect(result.findings[0]!.problem).toContain("not signed in");
  });

  it("reports healthy when every connection runs", () => {
    expect(diagnoseLimix({ engines, bots, channels: [{ id: "1", platform: "telegram", status: "running" }] })).toMatchObject({ ok: true, findings: [] });
  });
});
