import { describe, expect, it } from "vitest";
import { savedImageConnections } from "./limix-image-connections.ts";

describe("saved image connections", () => {
  it("keeps every saved key paired with its own explicit URL", () => {
    const entries = savedImageConnections({
      one: { driver: "openai-compat", displayName: "One", config: { url: "https://one.example/v1", key: "one-key" } },
      two: { driver: "openai-compat", config: { url: "https://two.example/v1", apiKeyEnv: "TWO" }, environment: { TWO: "two-key", OPENAI_COMPAT_API_KEY: "wrong-key" } },
      noKey: { driver: "openai-compat", config: { url: "https://other.example/v1", apiKeyEnv: "OTHER" }, environment: { OPENAI_COMPAT_API_KEY: "wrong-key" } },
      noUrl: { driver: "openai-compat", config: { key: "private" } },
      disabled: { driver: "openai-compat", enabled: false, config: { url: "https://one.example/v1", key: "private" } },
      cli: { driver: "codex", config: { url: "https://one.example/v1", key: "private" } },
      badUrl: { driver: "openai-compat", config: { url: "https://user:password@one.example/v1", key: "private" } },
    });
    expect(entries).toEqual([
      { id: "one", name: "One", url: "https://one.example/v1", key: "one-key" },
      { id: "two", name: "two", url: "https://two.example/v1", key: "two-key" },
    ]);
  });
});
