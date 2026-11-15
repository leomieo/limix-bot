import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { setLocale } from "@/lib/i18n";
import { LimixTrialBlock } from "./CloudAccountSettings";

it("Limix: offers a trial request, then says it waits for approval, with nothing to buy", () => {
  setLocale("vi");
  const none = renderToStaticMarkup(createElement(LimixTrialBlock, { trial: "none", busy: false, onAsk: () => {} }));
  expect(none).toContain("Đăng ký dùng thử");
  expect(none).not.toMatch(/checkout|\$/i);
  const pending = renderToStaticMarkup(createElement(LimixTrialBlock, { trial: "pending", busy: false, onAsk: () => {} }));
  expect(pending).toContain("Đã gửi yêu cầu dùng thử");
  expect(pending).not.toContain("<button");
  expect(renderToStaticMarkup(createElement(LimixTrialBlock, { trial: "declined", busy: false, onAsk: () => {} }))).toContain("gửi lại");
  setLocale("en");
  expect(renderToStaticMarkup(createElement(LimixTrialBlock, { trial: undefined, busy: true, onAsk: () => {} }))).toContain("Request a trial");
});
