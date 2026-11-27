// @vitest-environment happy-dom
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { expect, it, vi } from "vitest";
import { LimixPhoneBrowser } from "./LimixPhoneBrowser";
import { api } from "@/state/api";
const workspace = vi.hoisted(() => ({ config: {} as { cloudHome?: boolean; team?: { name: string } } }));
vi.mock("@/state/store", async (original) => ({ ...await original<typeof import("@/state/store")>(), useStore: () => ({ state: workspace }) }));
vi.mock("@/state/api", () => ({ api: vi.fn() }));

it("repairs a connecting address before issuing a remote pairing code", async () => {
  const endpoint = "https://fixture.limixmedia.com";
  const prepare = vi.fn(async () => ({ status: "ready", endpoint }));
  vi.stubGlobal("ogb", { companion: { start: vi.fn(), setRoute: vi.fn() }, companionAccount: {
    state: async () => ({ status: "connecting", endpoint }), prepare,
  } });
  vi.mocked(api).mockResolvedValue({ code: "123456", expiresAt: Date.now() + 60000 });
  const el = document.createElement("div");
  const root = createRoot(el);
  try {
    flushSync(() => root.render(createElement(LimixPhoneBrowser)));
    el.querySelector<HTMLButtonElement>("[data-limix-remote] button")!.click();
    await vi.waitFor(() => expect(api).toHaveBeenCalledWith("/api/auth/pairing", expect.objectContaining({ method: "POST" })));
    expect(prepare).toHaveBeenCalledOnce();
    expect(el.querySelector("svg path")).toBeTruthy();
  } finally {
    root.unmount();
    vi.unstubAllGlobals();
  }
});

it("shows internet pairing without local network controls on My Cloud", async () => {
  workspace.config = { cloudHome: true };
  vi.mocked(api).mockResolvedValue({ url: "https://fixture.example/pair#code=123456", code: "123456", expiresAt: Date.now() + 60000 });
  const el = document.createElement("div");
  const root = createRoot(el);
  try {
    flushSync(() => root.render(createElement(LimixPhoneBrowser)));
    await vi.waitFor(() => expect(el.textContent).toContain("123456"));
    expect(el.querySelector('[data-limix-phone="cloud"]')).toBeTruthy();
    expect(el.querySelector('[role="tablist"]')).toBeNull();
  } finally {
    root.unmount();
    workspace.config = {};
  }
});
