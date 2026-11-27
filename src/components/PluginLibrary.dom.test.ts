// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/state/store", () => ({ api }));
vi.mock("@/lib/i18n", () => ({ activeLocale: () => "vi" }));
import { PluginLibrary } from "./PluginLibrary";

it("shows permissions before download and writes scope changes for the chosen team", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const name = { vi: "Gói thử", en: "Sample" };
  const row = { id: "sample", sha256: "abc", name, description: name, requiresMcp: ["github"], version: "1.0.0" };
  const model = { catalog: [row], installed: [], teams: ["Support"], bots: [] };
  api.mockResolvedValue(model);
  const button = (label: string) => [...host.querySelectorAll("button")].find(b => b.textContent?.includes(label))!;
  try {
    await act(async () => root.render(createElement(PluginLibrary)));
    await act(async () => button("Kho Plugin").click());
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
  } finally { await act(async () => root.unmount()); }
});
