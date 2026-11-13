import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { makeFakeDriver } from "../testing/fake-driver.ts";
import { enginesBinDir } from "../engine-install.ts";
const fixture = vi.hoisted(() => ({ install: vi.fn(), latest: vi.fn().mockResolvedValue("0.169.0") }));
vi.mock("../engine-install.ts", async (original) => ({ ...await original<typeof import("../engine-install.ts")>(), installNpmEngine: fixture.install, npmLatestVersion: fixture.latest }));
const { ProviderRegistry } = await import("./registry.ts");

it("updates Codex to the latest stable npm version and selects the copy that was installed", async () => {
  const fake = makeFakeDriver({ kind: "codex" });
  fake.driver.defaultConfig = () => ({ cli: "codex" });
  Object.assign(fake.driver, { install: { npmPackage: "@openai/codex" } });
  const registry = new ProviderRegistry([fake.driver], { enginesBaseDir: "/fixture/data", npmAvailable: () => true });
  await registry.load({ codex: { driver: "codex", config: { cli: "/some/old/codex" } } });
  expect(await registry.installRuntime("codex", { update: true })).toEqual({ useCli: join(enginesBinDir("/fixture/data"), process.platform === "win32" ? "codex.cmd" : "codex"), expectedVersion: "0.169.0" });
  expect(fixture.latest).toHaveBeenCalledWith("@openai/codex", "/fixture/data");
  expect(fixture.install).toHaveBeenCalledWith("@openai/codex", { baseDir: "/fixture/data", cli: "codex", version: "0.169.0" });
  await registry.disposeAll();
});
