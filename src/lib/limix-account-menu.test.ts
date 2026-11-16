import { afterEach, expect, it, vi } from "vitest";
import { withLimixSignOut } from "./limix-account-menu";
import type { SidebarMenuItem } from "@/components/SidebarPopoverMenu";

afterEach(() => vi.unstubAllGlobals());

it("shows one desktop sign-out while retaining account switching", () => {
  vi.stubGlobal("window", { ogb: { limixAccount: {} } });
  const cloudSignOut = vi.fn(), desktopSignOut = vi.fn();
  const items: SidebarMenuItem[] = [
    { key: "accounts-active", label: "leox" },
    { key: "accounts-add", label: "Add account" },
    { key: "accounts-sign-out", label: "Sign out", onSelect: cloudSignOut },
  ];
  const result = withLimixSignOut({ username: "leox", email: "" }, items, desktopSignOut);
  expect(result.map(item => item.key)).toEqual(["accounts-active", "accounts-add", "limix-sign-out"]);
  result.at(-1)!.onSelect!();
  expect(desktopSignOut).toHaveBeenCalledOnce();
  expect(cloudSignOut).not.toHaveBeenCalled();
  expect(withLimixSignOut(null, items, desktopSignOut)).toBe(items);
  expect(items).toHaveLength(3);
});

it("keeps Cloud sign-out when the desktop Limix account bridge is unavailable", () => {
  vi.stubGlobal("window", {});
  const items: SidebarMenuItem[] = [{ key: "accounts-sign-out", label: "Sign out" }];
  expect(withLimixSignOut({ username: "leox", email: "" }, items, vi.fn())).toBe(items);
});
