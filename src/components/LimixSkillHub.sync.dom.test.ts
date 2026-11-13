// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";
import { LimixSkillHub } from "./LimixSkillHub";

it("removes Sources and syncs the catalog from Discover", async () => {
  setLocale("vi");
  const data = { repo: "leomieo/limix-skill-hub", settings: { autoSync: true, autoInstall: false, lastSync: null, lastError: null }, skills: [] };
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(data)));
  vi.stubGlobal("fetch", fetch);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = (label: string) => [...host.querySelectorAll("button")].find((node) => node.textContent === label);
  try {
    flushSync(() => root.render(createElement(LimixSkillHub)));
    await vi.waitFor(() => expect(host.textContent).toContain("Chưa có danh mục"));
    expect(button("Nguồn")).toBeUndefined();
    expect(button("Đồng bộ ngay")).toBeUndefined();
    flushSync(() => button("Khám phá")!.click());
    expect(button("Đồng bộ ngay")).toBeDefined();
    flushSync(() => button("Đồng bộ ngay")!.click());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/limix/hub/sync", expect.objectContaining({ method: "POST", body: "{}" })));
    await vi.waitFor(() => expect(button("Đồng bộ ngay")!.disabled).toBe(false));
    expect(host.textContent).toContain("Đồng bộ gần nhất");
  } finally {
    flushSync(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    setLocale("en");
  }
});
