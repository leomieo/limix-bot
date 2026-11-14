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
    await vi.waitFor(() => expect(document.body.textContent).toContain("No folder selected"));
    expect(installRequirements).not.toHaveBeenCalled();
    expect(button("Install packages").disabled).toBe(true);
    flushSync(() => button("Choose project folder…").click());
    await vi.waitFor(() => expect(button("Install packages").disabled).toBe(false));
    flushSync(() => button("Install packages").click());
    await vi.waitFor(() => expect(installRequirements).toHaveBeenCalledWith(["req-remotion"], "C:/Video project"));
  } finally {
    flushSync(() => root.unmount());
    host.remove();
    if (original) Object.defineProperty(window, "ogb", original);
    else Reflect.deleteProperty(window, "ogb");
  }
});

it("installs a standalone tool without opening the project picker", async () => {
  setLocale("en");
  const snapshot = { supported: true, items: [], skillScan: { skillCount: 1, requirements: [
    { id: "req-cli", installable: true, installScope: "tool", packages: ["agent-desktop"], skill: "windows", directory: "/skills/windows", kind: "npm", name: "agent-desktop", status: "missing", evidence: "npm install -g agent-desktop" },
  ] } };
  const pickFolder = vi.fn(), installRequirements = vi.fn().mockResolvedValue(snapshot);
  const original = Object.getOwnPropertyDescriptor(window, "ogb");
  Object.defineProperty(window, "ogb", { configurable: true, value: { pickFolder, limixTools: { scan: vi.fn().mockResolvedValue(snapshot), installRequirements } } });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(LimixToolsDialog, { onClose: () => {} })));
    const button = (text: string) => [...document.querySelectorAll("button")].find(node => node.textContent === text)!;
    await vi.waitFor(() => expect(button("Install all missing requirements")).toBeDefined());
    flushSync(() => button("Install all missing requirements").click());
    expect(pickFolder).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Limix Bot’s tools folder");
    flushSync(() => button("Install packages").click());
    await vi.waitFor(() => expect(installRequirements).toHaveBeenCalledWith(["req-cli"], ""));
  } finally {
    flushSync(() => root.unmount()); host.remove();
    if (original) Object.defineProperty(window, "ogb", original); else Reflect.deleteProperty(window, "ogb");
  }
});

it("uses one full-width tab at a time and collapses prose guidance by skill", async () => {
  setLocale("en");
  const snapshot = { supported: true, items: [{ id: "node", name: "Node.js", why: "JavaScript runtime", size: "30 MB", installed: true, job: null }], skillScan: { skillCount: 1, requirements: [
    { kind: "npm", name: "remotion", status: "missing", skill: "Video", directory: "/video", evidence: "npm install remotion" },
    { kind: "review", name: "Long prose instruction", status: "review", skill: "Video", directory: "/video", evidence: "Review this workflow before running it." },
  ] } };
  const original = Object.getOwnPropertyDescriptor(window, "ogb");
  Object.defineProperty(window, "ogb", { configurable: true, value: { limixTools: { scan: vi.fn().mockResolvedValue(snapshot) } } });
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(LimixToolsDialog, { onClose: () => {} })));
    await vi.waitFor(() => expect(document.querySelectorAll('[role="tabpanel"]').length).toBe(2));
    const base = document.getElementById("limix-tools-base-panel")!, requirements = document.getElementById("limix-tools-requirements-panel")!;
    expect(base.hidden).toBe(false); expect(requirements.hidden).toBe(true);
    flushSync(() => document.getElementById("limix-tools-requirements-tab")!.click());
    expect(base.hidden).toBe(true); expect(requirements.hidden).toBe(false);
    const group = [...requirements.querySelectorAll("details")].find(node => node.querySelector("summary")?.textContent?.includes("Video"))!;
    expect(group.open).toBe(false);
    const missing = [...requirements.querySelectorAll("button")].find(node => node.textContent?.startsWith("Missing"))!;
    flushSync(() => missing.click()); expect(missing.getAttribute("aria-pressed")).toBe("true");
    expect(requirements.textContent).toContain("remotion");
  } finally {
    flushSync(() => root.unmount()); host.remove();
    if (original) Object.defineProperty(window, "ogb", original); else Reflect.deleteProperty(window, "ogb");
  }
});
