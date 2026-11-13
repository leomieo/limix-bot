import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.unstubAllGlobals());

it("fetches the standalone repository and reports a refresh failure even with a cached catalog", async () => {
  vi.resetModules();
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ format: "openmaus.catalog", version: 1, bots: [] })));
  vi.stubGlobal("fetch", fetcher);
  const { handleLimixBotLibrary } = await import("./limix-bot-library.ts");
  expect((await handleLimixBotLibrary("GET", "/api/limix/bots"))?.status).toBe(200);
  expect(fetcher.mock.calls[0]?.[0]).toBe("https://raw.githubusercontent.com/leomieo/limix-bot-templates/main/catalog.json");
  fetcher.mockRejectedValue(new Error("offline"));
  expect((await handleLimixBotLibrary("POST", "/api/limix/bots/refresh"))?.status).toBe(502);
  expect(fetcher.mock.calls[1]?.[0]).toMatch(/catalog\.json\?t=\d+$/);
  expect((await handleLimixBotLibrary("GET", "/api/limix/bots"))?.status).toBe(200);
});
