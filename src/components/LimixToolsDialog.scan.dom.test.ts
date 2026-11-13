// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LimixToolsDialog } from "./LimixToolsDialog";
import { setLocale } from "@/lib/i18n";

it("scans again on demand and shows requirements, evidence and incomplete checks", async () => {
  setLocale("en");
  const scan = vi.fn().mockResolvedValue({ supported: true, items: [], skillScan: {
    skillCount: 2, requirements: [
      { skill: "video-maker", directory: "/skills/video-maker", kind: "npm", name: "remotion", status: "found", version: "4.0.0", where: "/project/node_modules/remotion/package.json", evidence: "npm install remotion" },
      { skill: "video-maker", directory: "/skills/video-maker", kind: "npm", name: "@remotion/cli", status: "missing", evidence: "npx remotion" },
      { skill: "gpu-render", directory: "/skills/gpu-render", kind: "review", name: "NVIDIA GPU required", status: "review", evidence: "Requirements" },
    ], warnings: ["Unreadable reference"],
  } });
  const original = Object.getOwnPropertyDescriptor(window, "ogb");
  Object.defineProperty(window, "ogb", { configurable: true, value: { limixTools: { scan } } });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(LimixToolsDialog, { onClose: vi.fn() })));
    await vi.waitFor(() => expect(document.body.textContent).toContain("Read 2 skills"));
    expect(document.body.textContent).toContain("remotion");
    expect(document.body.textContent).toContain("Found");
    expect(document.body.textContent).toContain("Not found");
    expect(document.body.textContent).toContain("Needs review");
    expect(document.body.textContent).toContain("npm install remotion");
    expect(document.body.textContent).toContain("1 items could not be fully read");
    scan.mockResolvedValue({ supported: true, items: [], skillScan: { error: "server offline" } });
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent === "Scan this computer")!;
    flushSync(() => button.click());
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toContain("server offline"));
    expect(scan).toHaveBeenCalledTimes(2);
  } finally {
    flushSync(() => root.unmount());
    host.remove();
    if (original) Object.defineProperty(window, "ogb", original);
    else Reflect.deleteProperty(window, "ogb");
  }
});

it("reviews missing packages and the destination before starting the batch installer", async () => {
  setLocale("en");
  const snapshot = { supported: true, items: [], skillScan: { skillCount: 1, requirements: [
    { id: "req-remotion", installable: true, packages: ["remotion", "@remotion/cli"], optional: true, skill: "video", directory: "/skills/video", kind: "npm", name: "remotion", status: "missing", evidence: "Code rendering" },
  ] } };
  const scan = vi.fn().mockResolvedValue(snapshot);
  const installRequirements = vi.fn().mockResolvedValue(snapshot);
  const original = Object.getOwnPropertyDescriptor(window, "ogb");
  Object.defineProperty(window, "ogb", { configurable: true, value: { pickFolder: vi.fn().mockResolvedValue("C:/Video project"), limixTools: { scan, installRequirements } } });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = (text: string) => [...document.querySelectorAll("button")].find((node) => node.textContent === text)!;
  try {
    flushSync(() => root.render(createElement(LimixToolsDialog, { onClose: vi.fn() })));
    await vi.waitFor(() => expect(button("Install all missing requirements")).toBeDefined());
    flushSync(() => button("Install all missing requirements").click());
    await vi.waitFor(() => expect(document.body.textContent).toContain("C:/Video project"));
    expect(installRequirements).not.toHaveBeenCalled();
    flushSync(() => button("Install packages").click());
    await vi.waitFor(() => expect(installRequirements).toHaveBeenCalledWith(["req-remotion"], "C:/Video project"));
  } finally {
    flushSync(() => root.unmount());
    host.remove();
    if (original) Object.defineProperty(window, "ogb", original);
    else Reflect.deleteProperty(window, "ogb");
  }
});
