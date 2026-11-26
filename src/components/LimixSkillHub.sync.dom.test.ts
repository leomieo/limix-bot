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

it("sorts by popularity or catalog date and combines topic, stars and inclusive date filters", async () => {
  setLocale("en");
  const base = { grade: "recommended", description: "fixture", tags: [], dependencies: [], permissions: {}, source: {}, compatibility: { runtimes: [] }, notes: [], security_status: "clean" };
  const skills = [
    { id: "old", stars: 99, added_at: "2026-10-01T12:00:00", category: "video" },
    { id: "new", stars: 80, added_at: "2026-11-25T23:59:59", category: "video" },
    { id: "low", stars: 1, added_at: "2026-11-25T12:00:00", category: "video" },
    { id: "other", stars: 100, added_at: "2026-11-25T15:00:00", category: "design" },
    { id: "unknown", category: "video" },
  ].map((s) => ({ ...base, ...s, name: s.id }));
  vi.stubGlobal("fetch", async () => Response.json({ settings: {}, skills }));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const names = () => [...host.querySelectorAll("li span.font-mono")].map((n) => n.textContent);
  const change = (el: HTMLInputElement | HTMLSelectElement, value: string) => flushSync(() => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el.type === "number" ? "input" : "change", { bubbles: true }));
  });
  try {
    flushSync(() => root.render(createElement(LimixSkillHub)));
    await vi.waitFor(() => expect(names()).toHaveLength(5));
    const sort = host.querySelector<HTMLSelectElement>('[aria-label="Sort by"]')!;
    change(sort, "stars");
    expect(names()).toEqual(["other", "old", "new", "low", "unknown"]);
    change(sort, "newest");
    expect(names()).toEqual(["new", "other", "low", "old", "unknown"]);
    change(host.querySelector<HTMLSelectElement>('[aria-label="Topic"]')!, "video");
    change(host.querySelector<HTMLInputElement>('input[type="number"]')!, "50");
    const dates = host.querySelectorAll<HTMLInputElement>('input[type="date"]');
    change(dates[0], "2026-11-25");
    change(dates[1], "2026-11-25");
    expect(names()).toEqual(["new"]);
    flushSync(() => [...host.querySelectorAll("button")].find((b) => b.textContent === "Clear filters")!.click());
    expect(names()).toHaveLength(5);
  } finally {
    flushSync(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
