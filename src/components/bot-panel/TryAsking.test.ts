// @vitest-environment happy-dom
// MausBot's example asks live in its panel in Simple mode: a tap sends one.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";
import type { Bot } from "@/state/store";

const f = vi.hoisted(() => ({ advanced: false, admin: true, dispatch: vi.fn(), openTemplates: vi.fn() }));
vi.mock("@/lib/industry-suggestions", () => ({ openIndustrySuggestions: f.openTemplates }));
vi.mock("@/lib/use-owner-or-admin", () => ({ useOwnerOrAdmin: () => f.admin }));
vi.mock("@/lib/interface-mode", () => ({ useAdvancedMode: () => f.advanced }));
vi.mock("@/state/store", () => ({ useStore: () => ({ state: {}, dispatch: f.dispatch }) }));
vi.mock("../HelperIntro", () => ({ HELPER_ASK_KEYS: ["helperIntro.ask.overview", "helperIntro.ask.inbox", "helperIntro.ask.routine", "helperIntro.ask.howto"] }));
const { TryAsking } = await import("./TryAsking");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const bot = (extra: Partial<Bot> = {}) => ({ id: "maus", threadId: "t", name: "MausBot", defaultBot: {}, ...extra }) as Bot;
let host: HTMLDivElement, root: Root;
const show = async (target: Bot) => { await act(async () => { root.render(createElement(TryAsking, { bot: target })); }); };

beforeEach(() => {
  setLocale("en");
  f.advanced = false;
  f.admin = true;
  f.openTemplates.mockReset();
  f.dispatch.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("Try asking", () => {
  it("lists MausBot's four asks, and a tap sends one in the open conversation", async () => {
    await show(bot());
    const asks = [...host.querySelectorAll<HTMLButtonElement>("[data-panel-ask]")];
    expect(host.textContent).toContain("Try asking");
    expect(asks.map((ask) => ask.textContent)).toEqual(["What are my bots up to?", "Set up a bot for my inbox", "Make me a morning routine", "How do I connect my email?"]);
    await act(async () => { asks[1]!.click(); });
    expect(f.dispatch).toHaveBeenCalledWith({ type: "send", botId: "maus", text: "Set up a bot for my inbox", threadId: "t" });
  });

  it("keeps template pickers available in the default helper's details after onboarding, in either mode", async () => {
    await show(bot({ defaultBot: undefined }));
    expect(host.textContent).toBe("");
    for (const advanced of [false, true]) {
      f.advanced = advanced;
      await show(bot());
      const picks = [...host.querySelectorAll<HTMLButtonElement>("[data-helper-template]")];
      expect(picks.map(button => button.dataset.helperTemplate)).toEqual(["department", "team", "support"]);
      await act(async () => { picks[1]!.click(); });
      expect(f.openTemplates).toHaveBeenLastCalledWith("team", picks[1]);
      expect(host.querySelector("[data-panel-ask]") === null).toBe(advanced);
    }
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it("only offers templates where the library is available", async () => {
    f.admin = false;
    await show(bot());
    expect(host.querySelector("[data-helper-template]")).toBeNull();
    expect(host.querySelector("[data-panel-ask]")).not.toBeNull();
    f.admin = true;
    f.advanced = true;
    const previous = window.ogb;
    try {
      Object.defineProperty(window, "ogb", { configurable: true, value: { remoteClient: { active: true } } });
      await show(bot());
      expect(host.textContent).toBe("");
    } finally {
      Object.defineProperty(window, "ogb", { configurable: true, value: previous });
    }
  });
});
