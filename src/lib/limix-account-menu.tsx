import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import type { SidebarMenuItem } from "@/components/SidebarPopoverMenu";

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

/** Adds "Đăng xuất" at the end of the account menu. The desktop app asks to confirm, signs out and restarts at the
 * sign-in window. */
export function withLimixSignOut(account: { username: string; email: string } | null, items: SidebarMenuItem[]): SidebarMenuItem[] {
  if (!account || !window.ogb?.limixAccount) return items;
  return [...items, {
    key: "limix-sign-out",
    label: "Đăng xuất",
    subtitle: account.username ? `Tài khoản Limix: ${account.username}` : "Tài khoản Limix",
    icon: <LogOut size={16} aria-hidden />,
    separatorBefore: true,
    onSelect: () => { void window.ogb?.limixAccount?.signOut().catch(() => undefined); },
  }];
}
