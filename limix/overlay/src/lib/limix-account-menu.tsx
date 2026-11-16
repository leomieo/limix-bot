import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import type { SidebarMenuItem } from "@/components/SidebarPopoverMenu";
import { lx } from "@/lib/limix-text";

/** The Limix account this computer is signed in to (desktop app only), for the "Đăng xuất" item in the account menu. */
export function useLimixAccount(): { username: string; email: string } | null {
  const [account, setAccount] = useState<{ username: string; email: string } | null>(null);
  useEffect(() => {
    let live = true;
    void window.ogb?.limixAccount?.info().then((info) => { if (live) setAccount(info); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  return account;
}

/** The Limix desktop session owns sign-out; Cloud account switching stays available. */
export function withLimixSignOut(account: { username: string; email: string } | null, items: SidebarMenuItem[], onSignOut: () => void): SidebarMenuItem[] {
  if (!account || !window.ogb?.limixAccount) return items;
  return [...items.filter((item) => item.key !== "accounts-sign-out"), {
    key: "limix-sign-out",
    label: lx("Đăng xuất", "Sign out"),
    subtitle: account.username ? lx(`Tài khoản Limix: ${account.username}`, `Limix account: ${account.username}`) : lx("Tài khoản Limix", "Limix account"),
    icon: <LogOut size={16} aria-hidden />,
    separatorBefore: true,
    onSelect: onSignOut,
  }];
}
