// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InstanceInfo } from "@/state/store";

const fixture = vi.hoisted(() => ({
  instances: [] as InstanceInfo[],
  posts: [] as Array<{ path: string; body: Record<string, string> }>,
  deletes: [] as string[],
  rejectDiscovery: false,
}));
vi.mock("@/state/store", async (original) => ({
  ...await original<typeof import("@/state/store")>(),
  useStore: () => ({ state: { instances: fixture.instances, bots: [], config: {} }, dispatch: () => {}, refreshInstances: async () => {} }),
  api: async (path: string, init?: { method?: string; body?: string }) => {
    if (init?.method === "DELETE") { fixture.deletes.push(path); return {}; }
    if (!init?.body) return {};
    const body = JSON.parse(init.body);
    fixture.posts.push({ path, body });
    if (fixture.rejectDiscovery && !body.model) throw Error("Could not discover gateway models: HTTP 403, client_not_allowed");
    return {};
  },
}));
import { ClaudeEndpoints, CodexEndpoints } from "./ClaudeEndpoints";
import { OtherOpenAiCompatServers } from "./OpenAiCompatServers";
import { EnginesSettings } from "./EnginesSettings";

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fixture.posts = [];
  fixture.instances = [];
  fixture.deletes = [];
  fixture.rejectDiscovery = false;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function click(label: string, scope: ParentNode = container) {
  const button = [...scope.querySelectorAll("button")].find(button => button.textContent === label);
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
async function input(label: string, value: string, scope: ParentNode = container) {
  const field = scope.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  expect(field).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("starts the Claude form empty, with Anthropic's URL only as a placeholder", async () => {
  await act(async () => root.render(createElement(ClaudeEndpoints)));
  await click("Add endpoint");
  expect(container.querySelector("select")).toBeNull();
  const baseUrl = container.querySelector<HTMLInputElement>('input[aria-label="Base URL"]')!;
  expect(baseUrl.value).toBe("");
  expect(baseUrl.placeholder).toBe("https://api.anthropic.com");
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Name"]')!.value).toBe("");
  await input("Name", "Fixture host");
  await input("Token", "fixture-api-key");
  const save = [...container.querySelectorAll("button")].find(button => button.textContent === "Save")!;
  expect(save.disabled).toBe(true);
  expect(fixture.posts).toHaveLength(0);
});

it("edits and confirms deletion on only the chosen API row in AI settings", async () => {
  const endpoint = (instanceId: string, model: string, profile?: "xingchi"): InstanceInfo => ({
    instanceId, displayName: "Fixture connection", driverKind: "codex", access: "custom",
    snapshot: { state: "available", authenticated: true },
    models: { default: model, options: [{ id: model, label: model }] },
    codexEndpoint: { baseUrl: "https://api.xingchiapi.com/v1", model, models: [model], tokenSaved: true, profile },
  });
  fixture.instances = [endpoint("codex-endpoint-a", "model-a"), endpoint("codex-endpoint-b", "model-b", "xingchi")];
  await act(async () => root.render(createElement(EnginesSettings, { simple: true, more: { id: "more", open: false, onToggle: () => {} } })));
  const row = container.querySelector('[data-simple-engine="codex-endpoint-b"]')!;
  await click("Manage", row);
  expect(row.textContent).toContain("model-b");
  await click("Edit", row);
  const form = row.querySelector("form")!;
  expect(form.querySelector<HTMLInputElement>('input[aria-label="Model"]')?.value).toBe("model-b");
  expect(form.querySelector<HTMLInputElement>('input[aria-label="Base URL"]')?.readOnly).toBe(true);
  expect(form.querySelector<HTMLInputElement>('input[aria-label="Token"]')?.value).toBe("");
  await input("Name", "Second connection", form);
  await click("Save", row);
  expect(fixture.posts.at(-1)).toEqual({
    path: "/api/instances/codex-endpoint-b/codex-endpoint",
    body: { displayName: "Second connection", baseUrl: "https://api.xingchiapi.com/v1", model: "model-b" },
  });
  await click("Delete", row);
  expect(fixture.deletes).toEqual([]);
  await click("Delete", document.querySelector('[role="alertdialog"]')!);
  expect(fixture.deletes).toEqual(["/api/instances/codex-endpoint-b"]);
});
it("saves OpenAI for Codex when the URL is left empty, without an OAuth step", async () => {
  await act(async () => root.render(createElement(CodexEndpoints)));
  await click("Add endpoint");
  const baseUrl = container.querySelector<HTMLInputElement>('input[aria-label="Base URL"]')!;
  expect(baseUrl.value).toBe("");
  expect(baseUrl.placeholder).toBe("https://api.openai.com/v1");
  await input("Name", "OpenAI");
  await input("Token", "fixture-api-key");
  await click("Save");
  expect(fixture.posts).toEqual([{ path: "/api/instances/codex-endpoint", body: { displayName: "OpenAI", baseUrl: "https://api.openai.com/v1", token: "fixture-api-key" } }]);
});
it.each([
  { Component: ClaudeEndpoints, path: "/api/instances/claude-endpoint" },
  { Component: CodexEndpoints, path: "/api/instances/codex-endpoint" },
])("sends a typed model for a host without a model list ($path)", async ({ Component, path }) => {
  await act(async () => root.render(createElement(Component)));
  await click("Add endpoint");
  await input("Name", "Fixture host");
  await input("Base URL", "https://host.example/anthropic");
  await input("Token", "fixture-api-key");
  await input("Model", "fixture-model");
  await click("Save");
  expect(fixture.posts).toEqual([{ path, body: { displayName: "Fixture host", baseUrl: "https://host.example/anthropic", token: "fixture-api-key", model: "fixture-model" } }]);
});
it.each([
  { Component: ClaudeEndpoints, path: "/api/instances/claude-endpoint" },
  { Component: CodexEndpoints, path: "/api/instances/codex-endpoint" },
])("saves a custom URL directly from $path", async ({ Component, path }) => {
  await act(async () => root.render(createElement(Component)));
  await click("Add endpoint");
  await input("Name", "My CLIProxyAPI");
  await input("Base URL", "https://gateway.example/v1");
  await input("Token", "fixture-proxy-key");
  await click("Save");
  expect(fixture.posts).toEqual([{ path, body: { displayName: "My CLIProxyAPI", baseUrl: "https://gateway.example/v1", token: "fixture-proxy-key" } }]);
});

it("adds a custom API through Codex CLI from API settings when model discovery is refused", async () => {
  fixture.rejectDiscovery = true;
  await act(async () => root.render(createElement(OtherOpenAiCompatServers)));
  const native = container.querySelector("details")!;
  expect(native.querySelector("summary")?.textContent).toBe("Connect through Codex CLI");
  native.open = true;
  await click("Add endpoint");
  const form = native.querySelector("form")!;
  await input("Name", "Restricted provider", form);
  await input("Base URL", "https://gateway.example/v1", form);
  await input("Token", "fixture-proxy-key", form);
  await click("Save");
  expect(native.querySelector("[role=alert]")?.textContent).toContain("Enter the exact model ID");
  await input("Model", "fixture-model", form);
  await click("Save");
  expect(fixture.posts.at(-1)).toEqual({ path: "/api/instances/codex-endpoint", body: { displayName: "Restricted provider", baseUrl: "https://gateway.example/v1", token: "fixture-proxy-key", model: "fixture-model" } });
});
