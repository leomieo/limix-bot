import { expect, it } from "vitest";
import { parseBotListing, parseLibraryBot } from "./limix-bot-library.ts";
import { templateMascot, TEMPLATE_MASCOTS } from "../shared/template-mascot.ts";

const entry = (id: string, look: unknown = { color: "cyan", mascotBody: "hexagon" }) => ({
  id, name: "Template", title: "Role", category: "work", description: "Description", try: "Help me", look,
});
const catalog = (bots: unknown[]) => ({ format: "openmaus.catalog", version: 1, bots });
const detail = (id: string, look?: unknown) => ({
  ...entry(id, look), format: "limix.bot", version: 1, soul: "Instructions", tryAsking: ["Help me"],
});

it("assigns varied stable mascots to existing repeated template icons", () => {
  const bots = Array.from({ length: 100 }, (_, index) => entry(`template-${index}`));
  const first = parseBotListing(catalog(bots));
  expect(new Set(first.map(bot => JSON.stringify(bot.look))).size).toBeGreaterThan(50);
  const reversed = parseBotListing(catalog([...bots].reverse()));
  for (const bot of first) {
    expect(reversed.find(other => other.id === bot.id)?.look).toEqual(bot.look);
    expect(parseLibraryBot(detail(bot.id), bot.id).look).toEqual(bot.look);
  }
});

it("supports future automatic templates and preserves authored fixed looks", () => {
  for (const look of [{ mode: "auto" }, undefined]) {
    const raw = { ...entry("new-template"), look };
    expect(parseBotListing(catalog([raw]))[0]?.look).toEqual(templateMascot(raw.id));
  }
  for (const look of [{ color: "purple", mascotBody: "star" }, { color: "cyan", mascotBody: "hexagon", mode: "fixed" }]) {
    expect(parseBotListing(catalog([entry("custom", look)]))[0]?.look).toEqual({ color: look.color, mascotBody: look.mascotBody });
    expect(parseLibraryBot(detail("custom", look), "custom").look).toEqual({ color: look.color, mascotBody: look.mascotBody });
  }
});

it("continues rejecting malformed explicit looks", () => {
  expect(parseBotListing(catalog([entry("bad", { color: "invalid", mascotBody: "star" })]))).toEqual([]);
});


it("ships 300 distinct selectable icons and carries the look into the new bot", async () => {
  const { readyBotTemplate } = await import("../shared/ready-bots.ts");
  expect(TEMPLATE_MASCOTS).toHaveLength(300);
  expect(new Set(TEMPLATE_MASCOTS.map(icon => icon.id)).size).toBe(300);
  expect(new Set(TEMPLATE_MASCOTS.map(({ color, mascotBody, mascotExpression }) => JSON.stringify({ color, mascotBody, mascotExpression }))).size).toBe(300);
  for (const icon of TEMPLATE_MASCOTS) {
    const look = { iconId: icon.id };
    const bot = parseLibraryBot(detail("selected", look), "selected");
    expect(parseBotListing(catalog([entry("selected", look)]))[0]?.look).toEqual(bot.look);
    expect(bot.look).toEqual({ color: icon.color, mascotBody: icon.mascotBody, mascotExpression: icon.mascotExpression });
    const created = readyBotTemplate({ profile: {}, memory: {}, routines: [] } as any, bot);
    expect(created.profile).toMatchObject(bot.look);
  }
  expect(parseBotListing(catalog([entry("bad", { iconId: "missing" })]))).toEqual([]);
});
