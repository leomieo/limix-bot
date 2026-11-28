// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const { api, dispatch } = vi.hoisted(() => ({ api: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/state/store", () => ({ api, useStore: () => ({ state: { pluginsOpen: false }, dispatch }) }));
vi.mock("@/lib/i18n", () => ({ activeLocale: () => "vi", t: () => "Đóng" }));
import { PluginLibraryDialog, SidebarPluginButton } from "./PluginLibrary";

it("shows permissions before download and writes scope changes for the chosen team", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const name = { vi: "Gói thử", en: "Sample" };
  const row = { id: "sample", sha256: "abc", name, description: name, requiresMcp: ["github"], version: "1.0.0" };
  const model = { catalog: [row], installed: [], teams: ["Support"], bots: [{ id: "scout", name: "Scout", section: "Support" }] };
  api.mockResolvedValue(model);
  const button = (label: string) => [...host.querySelectorAll("button")].find(b => b.textContent?.includes(label))!;
  try {
    await act(async () => root.render(createElement(SidebarPluginButton)));
    await act(async () => button("Kho Plugin").click());
    expect(dispatch).toHaveBeenLastCalledWith({ type: "togglePlugins", open: true, surface: "library" });
    await act(async () => root.render(createElement(PluginLibraryDialog)));
    expect(host.querySelector('[role="dialog"] h2')?.textContent).toBe("Kho Plugin");
    expect(host.querySelector('a[href*="limix-plugin-hub"]')).toBeNull();
    expect(button("Đồng bộ kho")).toBeDefined();
    expect(host.textContent).toContain("Kết nối MCP cần có · github");
    api.mockResolvedValue({ ...model, installed: [{ ...row, instructions: "Workflow", teams: [], bots: {} }] });
    await act(async () => button("Tải về").click());
    expect(JSON.parse(api.mock.lastCall![1].body)).toMatchObject({ action: "install", id: row.id, sha256: row.sha256 });
    const select = async (field: HTMLSelectElement, value: string) => {
      await act(async () => { field.value = value; field.dispatchEvent(new Event("change", { bubbles: true })); });
    };
    await select(host.querySelector("select")!, "team:Support");
    await select(host.querySelectorAll("select")[1], "true");
    expect(JSON.parse(api.mock.lastCall![1].body)).toMatchObject({ action: "assign", target: "team", key: "Support", enabled: true });
    await select(host.querySelector("select")!, "bot:scout");
    await select(host.querySelectorAll("select")[1], "false");
    expect(JSON.parse(api.mock.lastCall![1].body)).toMatchObject({ action: "assign", target: "bot", key: "scout", enabled: false });
    const dialog = host.querySelector('[role="dialog"]')!;
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: "togglePlugins", open: false });
  } finally { await act(async () => root.unmount()); }
});
