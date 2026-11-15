import { describe, expect, it } from "vitest";

import { renameLegacyDefaultBots } from "./limix-assistant-name.ts";
import type { BotRecord } from "./store.ts";

function fixture(bots: Array<Partial<BotRecord>>) {
  const store = { bots: bots.map((bot, index) => ({ id: `b${index}`, name: "", ...bot }) as BotRecord), patchBot(id: string, patch: Partial<BotRecord>) { Object.assign(store.bots.find((bot) => bot.id === id)!, patch); } };
  return store;
}

describe("built-in helper name", () => {
  it("renames the helper while it keeps an old default name", () => {
    const store = fixture([{ name: "Limix Bot", defaultBot: {} }, { name: "MausBot", defaultBot: { person: "a@b.c" } }]);
    expect(renameLegacyDefaultBots(store)).toEqual(["b0", "b1"]);
    expect(store.bots.map((bot) => bot.name)).toEqual(["Trợ Lý Limix", "Trợ Lý Limix"]);
  });

  it("keeps a name the person chose and never renames an ordinary bot", () => {
    const store = fixture([{ name: "Thư ký của tôi", defaultBot: {} }, { name: "Limix Bot" }]);
    expect(renameLegacyDefaultBots(store)).toEqual([]);
    expect(store.bots.map((bot) => bot.name)).toEqual(["Thư ký của tôi", "Limix Bot"]);
  });

  it("does not create a second bot with the same name in a department", () => {
    const store = fixture([{ name: "Limix Bot", defaultBot: {} }, { name: "Trợ Lý Limix" }]);
    expect(renameLegacyDefaultBots(store)).toEqual([]);
  });
});
