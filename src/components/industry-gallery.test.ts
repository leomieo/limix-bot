// @vitest-environment happy-dom
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { INDUSTRY_BOTS } from "../../shared/industry-templates";
import { READY_BOTS } from "../../shared/ready-bots";
import { LimixBotGallery, templateCards } from "./LimixBotGallery";

const ui = vi.hoisted(() => ({ openedId: "", request: vi.fn() }));
vi.mock("@/state/store", () => ({ api: ui.request, useStore: () => ({ state: { config: null, bots: [] }, dispatch: vi.fn() }) }));
vi.mock("./lazy-screens", () => ({ NewBotDialog: ({ readyBotId }: { readyBotId: string }) => { ui.openedId = readyBotId; return null; } }));

describe("industry bot gallery", () => {
  it("selects an industry and opens its role while the remote library is offline", () => {
    ui.request.mockRejectedValue(new Error("offline"));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      flushSync(() => root.render(createElement(LimixBotGallery, { search: "", onDialog: vi.fn(), onAdded: vi.fn() })));
      const select = host.querySelector("select")!;
      expect(select.options).toHaveLength(11);
      flushSync(() => {
        select.value = "food-beverage";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      const cards = Array.from(host.querySelectorAll<HTMLElement>("[data-ready-bot]"));
      expect(cards).toHaveLength(4);
      const role = cards.find((card) => card.dataset.readyBot?.startsWith("industry-food-beverage-"))!;
      flushSync(() => role.querySelectorAll("button")[1]!.click());
      expect(ui.openedId).toBe(role.dataset.readyBot);
      expect(ui.request).toHaveBeenCalledTimes(1);
    } finally {
      flushSync(() => root.unmount());
      host.remove();
    }
  });
  it("opens bundled templates offline and preserves the host copy if a remote id collides", () => {
    const offline = templateCards([]);
    expect(offline).toHaveLength(READY_BOTS.length + INDUSTRY_BOTS.length);
    const local = offline.find((bot) => bot.id === "industry-customer-care")!;
    const remote = { ...local, id: "external", name: "External" };
    const online = templateCards([{ ...local, name: "Network copy" }, remote]);
    expect(online.filter((card) => card.id === local.id)).toEqual([local]);
    expect(online.find((card) => card.id === remote.id)).toMatchObject({ builtIn: false });
    expect(online.filter((card) => card.builtIn)).toHaveLength(INDUSTRY_BOTS.length + 1);
  });
});
