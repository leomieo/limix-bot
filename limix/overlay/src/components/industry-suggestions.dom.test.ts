// @vitest-environment happy-dom
import { createElement, Fragment } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";
import { INDUSTRY_PROFILES } from "../../shared/industry-profiles";
import { INDUSTRY_CARE_SKILL } from "../../shared/industry-templates";
import { HelperTemplateSuggestions } from "./HelperTemplateSuggestions";
import { Sidebar } from "./Sidebar";

const requests = vi.hoisted(() => vi.fn());
vi.mock("@/state/store", async original => {
  const store = await original<typeof import("@/state/store")>();
  return { ...store, api: requests, useStore: () => ({ state: store.initialState, dispatch: vi.fn() }) };
});
vi.mock("@/lib/use-owner-or-admin", () => ({ useOwnerOrAdmin: () => true }));

it("opens the department, team and support pickers from the assistant and returns keyboard focus on close", async () => {
  setLocale("vi");
  const teams = INDUSTRY_PROFILES.map(profile => ({ slug: "industry-" + profile.slug, builtIn: true, name: profile.name,
    summary: profile.description, category: profile.name, members: 4, skills: [], requires: { apps: [] } }));
  requests.mockImplementation(async (url: string) => {
    if (url === "/api/org-library") return { organization: "Fixture", packages: [] };
    if (url === "/api/team-library/catalog") return { teams: [...teams, { ...teams[0], slug: "community", builtIn: false }] };
    if (url === "/api/limix/bots") return { bots: [] };
    return {};
  });
  const host = document.createElement("div");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } })));
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(Fragment, {},
      createElement(HelperTemplateSuggestions), createElement(Sidebar, { open: true, onClose: vi.fn() }))));
    for (const kind of ["department", "team", "support"]) {
      const trigger = host.querySelector<HTMLButtonElement>(`[data-helper-template="${kind}"]`)!;
      trigger.focus();
      flushSync(() => trigger.click());
      await vi.waitFor(() => {
        if (kind === "team") {
          expect([...document.querySelectorAll("[data-team-details]")].map(node => node.getAttribute("data-team-details"))).toEqual(teams.map(team => team.slug));
        } else {
          const ids = [...document.querySelectorAll("[data-ready-bot]")].map(node => node.getAttribute("data-ready-bot"));
          if (kind === "support") expect(ids).toEqual([INDUSTRY_CARE_SKILL]);
          else {
            expect(ids).toHaveLength(30);
            expect(ids).not.toContain(INDUSTRY_CARE_SKILL);
          }
        }
      });
      expect(requests.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
      flushSync(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
      expect(document.activeElement).toBe(trigger);
    }
  } finally {
    flushSync(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
