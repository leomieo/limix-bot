import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ dir: "" }));
vi.mock("./config.ts", () => ({ get DATA_DIR() { return fixture.dir; } }));
vi.mock("./limix-lang.ts", () => ({ lxs: (_vi: string, en: string) => en }));
vi.mock("./skill-library.ts", () => ({
  installLibrarySkill: vi.fn(() => ({})),
  readSkillLibraryIndex: () => ({}),
  retireLibrarySkill: vi.fn(),
  setLibrarySkillReviewState: vi.fn(),
}));

import { handleLimixHub } from "./limix-skill-hub.ts";
import { installLibrarySkill } from "./skill-library.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  if (fixture.dir) rmSync(fixture.dir, { recursive: true, force: true });
});

it.each([false, true])("refreshes a stale catalog without silently installing a different quarantined revision (%s)", async (updated) => {
  fixture.dir = mkdtempSync(join(tmpdir(), "limix-skill-refresh-"));
  const content = "---\nname: example\ndescription: Fixture\n---\nExample";
  const hash = createHash("sha256").update(content).digest("hex");
  const entry = {
    id: "example", area: "quarantine", security_status: "quarantined", approval_status: "rejected",
    source: {}, compatibility: {}, tags: [], notes: [], checksum: hash,
    file_hashes: { "SKILL.md": hash, "examples/removed.html": hash },
  };
  let refreshes = 0;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/registry/catalog.json")) {
      refreshes++;
      const next = updated && refreshes > 1 ? { ...entry, checksum: "new-checksum", file_hashes: { "SKILL.md": hash } } : entry;
      return Response.json({ skills: [next] });
    }
    return url.endsWith("/SKILL.md") ? new Response(content) : new Response(null, { status: 404 });
  }));
  expect((await handleLimixHub("POST", "/api/limix/hub/sync", {}))?.status).toBe(200);
  const install = () => handleLimixHub("POST", "/api/limix/hub/install", { id: "example", allowRisky: true });
  const result = await install();
  expect(result?.status).toBe(updated ? 409 : 422);
  expect(result?.body).toEqual({ error: expect.stringContaining(updated ? "Review this skill" : "examples/removed.html") });
  expect(refreshes).toBe(2);
  expect(installLibrarySkill).not.toHaveBeenCalled();
  if (updated) {
    expect((await install())?.status).toBe(200);
    expect(installLibrarySkill).toHaveBeenCalledWith(expect.objectContaining({ name: "example", reviewState: "disabled" }));
  }
});
