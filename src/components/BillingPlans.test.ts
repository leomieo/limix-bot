import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { CloudAccountState } from "../../electron/cloud-account.mjs";
import { setLocale } from "@/lib/i18n";
import { BillingPlansView } from "./BillingPlans";

it.each([
  ["free", "inactive", "pending", "Free"],
  ["pro", "active", "approved", "Limix Cloud Beta"],
  ["pro", "active", "pending", null],
  ["pro", "inactive", "approved", null],
] as const)("shows the verified plan for %s/%s/%s", (plan, status, limixTrial, expected) => {
  setLocale("vi");
  const account: CloudAccountState = { status: "connected", limixTrial, entitlement: { plan, status, version: 1, expiresAt: null } };
  const html = renderToStaticMarkup(createElement(BillingPlansView, { account }));
  if (expected) expect(html).toMatch(new RegExp(expected + "<span[^>]*>Gói hiện tại"));
  else expect(html).not.toContain("Gói hiện tại");
  expect(html).not.toContain("<button");
});
