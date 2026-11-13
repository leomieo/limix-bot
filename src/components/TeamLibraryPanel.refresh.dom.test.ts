// @vitest-environment happy-dom
import { createElement, createRef } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";

const fixture = vi.hoisted(() => ({ api: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/state/store", async (original) => ({
  ...await original<typeof import("@/state/store")>(),
  api: fixture.api,
  useStore: () => ({ state: { bots: [], sections: [], instances: [], config: {} }, dispatch: fixture.dispatch }),
}));
vi.mock("./lazy-screens", () => ({ NewBotDialog: () => null }));
const { TeamLibraryPanel } = await import("./TeamLibraryPanel");

let root: Root;
let host: HTMLElement;
let newCatalog = false;
let failBots = false;
const teamCatalog = () => ({ format: "openmaus.catalog", version: 1, repositoryUrl: "", teams: [{
  slug: "team", name: newCatalog ? "Updated team" : "Original team", summary: "Team summary", category: "work",
  members: 2, skills: [], requires: { apps: [] },
}] });
const bots = () => [{ id: "fixture-bot", name: newCatalog ? "Updated bot" : "Original bot", title: "Assistant", category: "work", description: "Bot summary", try: "Help me", look: { color: "green", mascotBody: "cursor" }, apps: [], routines: 0 }];
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((node) => node.textContent?.trim() === label)!;
const click = (label: string) => flushSync(() => button(label).click());

beforeEach(() => {
  setLocale("en");
  newCatalog = false;
  failBots = false;
  fixture.api.mockReset().mockImplementation(async (path: string) => {
    if (path === "/api/org-library") return { organization: null, packages: [] };
    if (path.startsWith("/api/team-library/catalog")) return teamCatalog();
    if (path === "/api/limix/bots/refresh" && failBots) throw new Error("offline");
    if (path.startsWith("/api/limix/bots")) return { bots: bots() };
    throw new Error(`Unexpected fixture request: ${path}`);
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  flushSync(() => root.render(createElement(TeamLibraryPanel, { onClose: vi.fn(), onImported: vi.fn(), returnFocusRef: createRef<HTMLButtonElement>() })));
});
afterEach(() => { flushSync(() => root.unmount()); host.remove(); });

it("separates bot and team tabs and refreshes both libraries from either tab", async () => {
  await vi.waitFor(() => expect(document.body.textContent).toContain("Original bot"));
  expect([...document.querySelectorAll('[role="tab"]')].map((node) => node.textContent)).toEqual(["Explore", "Import", "From a folder", "Share", "Team templates"]);
  expect(document.body.textContent).not.toContain("Original team");
  click("Team templates");
  expect(document.body.textContent).toContain("Original team");
  expect(document.body.textContent).not.toContain("Original bot");
  newCatalog = true;
  click("Update");
  await vi.waitFor(() => expect(document.body.textContent).toContain("Bot and team templates updated."));
  expect(fixture.api).toHaveBeenCalledWith("/api/limix/bots/refresh", { method: "POST" });
  expect(fixture.api).toHaveBeenCalledWith("/api/team-library/catalog?fresh=1");
  expect(document.body.textContent).toContain("Updated team");
  click("Explore");
  await vi.waitFor(() => expect(document.body.textContent).toContain("Updated bot"));
  expect(button("Update")).toBeDefined();
});

it("reports partial failures and lets the user retry", async () => {
  await vi.waitFor(() => expect(document.body.textContent).toContain("Original bot"));
  failBots = true;
  click("Update");
  await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not update bot templates"));
  expect(document.body.textContent).toContain("Original bot");
  failBots = false;
  newCatalog = true;
  click("Update");
  await vi.waitFor(() => expect(document.body.textContent).toContain("Bot and team templates updated."));
  expect(document.querySelector('[role="alert"]')).toBeNull();
});
