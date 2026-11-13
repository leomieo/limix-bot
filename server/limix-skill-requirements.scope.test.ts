import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ root: "", bundled: "", downloaded: "" }));
vi.mock("./config.ts", () => ({ get DATA_DIR() { return fixture.root; } }));
vi.mock("./skill-library.ts", () => ({
  loadBundledSkills: () => [{ manifest: { name: "Bundled" }, directory: fixture.bundled }],
  loadUserSkills: () => [],
  listLibrarySkills: () => [{ name: "downloaded" }],
  librarySkillDirectory: () => fixture.downloaded,
  skillsLibraryRoot: () => fixture.root,
}));
vi.mock("./imported-skills.ts", () => ({ readImportedSkills: () => ({}), IMPORTED_SKILLS_DIR: "unused" }));
vi.mock("./skills.ts", () => ({ listMigratableSkills: () => [] }));
const { scanSkillRequirements } = await import("./limix-skill-requirements.ts");
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(fixture.root, { recursive: true, force: true }); });

it("reads only bundled and downloaded app skills, ignoring catalog-only and external skill folders", async () => {
  fixture.root = mkdtempSync(join(tmpdir(), "limix-skill-scope-"));
  fixture.bundled = join(fixture.root, "bundled");
  fixture.downloaded = join(fixture.root, "downloaded");
  const external = join(fixture.root, "external-codex", "skills", "not-imported");
  const catalog = join(fixture.root, "catalog-only");
  for (const dir of [fixture.bundled, fixture.downloaded, external, catalog]) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "---\nname: example\ndescription: example\n---\nNo package requirements.");
  }
  vi.stubEnv("CODEX_HOME", join(fixture.root, "external-codex"));
  const fetch = vi.fn(() => { throw new Error("Scan must not download repository skills"); });
  vi.stubGlobal("fetch", fetch);
  const result = await scanSkillRequirements([]);
  expect(result.skillCount).toBe(2);
  expect(new Set(result.requirements.map((r) => r.skill))).toEqual(new Set(["Bundled", "downloaded"]));
  expect(fetch).not.toHaveBeenCalled();
});
