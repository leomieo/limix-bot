import { expect, it } from "vitest";
import { limixAppHidden, withoutLimixHiddenApps } from "./limix-app-catalog.ts";

it("leaves Telegram out of the apps catalog, whatever its case, and keeps every other app and field", () => {
  const catalog = { source: "api" as const, cards: [{ slug: "telegram", label: "Telegram" }, { slug: "TELEGRAM", label: "x" }, { slug: "slack", label: "Slack" }] };
  expect(withoutLimixHiddenApps(catalog)).toEqual({ source: "api", cards: [{ slug: "slack", label: "Slack" }] });
  expect(limixAppHidden("Telegram")).toBe(true);
  expect(limixAppHidden("telegram-bot")).toBe(false);
});
