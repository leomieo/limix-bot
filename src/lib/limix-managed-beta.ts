import { useEffect, useState } from "react";
import type { SidebarMenuItem } from "@/components/SidebarPopoverMenu";
import { lx } from "@/lib/limix-text";

export function useManagedBetaItem(username?: string): SidebarMenuItem[] {
  const [state, setState] = useState("hidden");
  const [busy, setBusy] = useState(false);
  const api = window.ogb?.limixAccount?.managedBeta;
  useEffect(() => {
    let active = true;
    setState("hidden");
    if (!username || !api) return;
    void api(false).then(value => { if (active) setState(value); }).catch(() => {});
    return () => { active = false; };
  }, [username, api]);
  if (!username || !api || state === "hidden") return [];
  const status: Record<string, string> = {
    available: lx("Yêu cầu khởi tạo", "Request setup"),
    queued: lx("Đang chờ máy chủ", "Queued"),
    starting: lx("Đang khởi động", "Starting"),
    running: lx("Dịch vụ đang chạy", "Service running"),
    waiting_capacity: lx("Đang chờ tài nguyên", "Waiting for capacity"),
    host_unreachable: lx("Chưa nhận trạng thái từ máy chủ", "Host status overdue"),
    failed: lx("Khởi động thất bại", "Startup failed"),
    offline: lx("Chưa lấy được trạng thái", "Status unavailable"),
  };
  return [{
    key: "limix-managed-beta", label: lx("Bot chạy trên Cloud (beta)", "Cloud-hosted bots (beta)"),
    subtitle: busy ? lx("Đang kiểm tra…", "Checking…") : status[state],
    keepOpen: true, disabled: busy, onSelect: () => {
      setBusy(true);
      void api(state === "available").then(setState).catch(() => setState("offline")).finally(() => setBusy(false));
    },
  }];
}
