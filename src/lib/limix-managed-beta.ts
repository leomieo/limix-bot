import { useEffect, useState } from "react";
import type { SidebarMenuItem } from "@/components/SidebarPopoverMenu";
import { lx } from "@/lib/limix-text";

export function useManagedBetaItem(username?: string): SidebarMenuItem[] {
  const [state, setState] = useState("hidden");
  const [busy, setBusy] = useState(false);
  const api = window.ogb?.limixAccount?.managedBeta;
  const open = window.ogb?.limixAccount?.managedBetaOpen;
  useEffect(() => {
    let active = true;
    setState("hidden");
    if (!username || !api) return;
    void api(false).then(value => { if (active) setState(value); }).catch(() => {});
    return () => { active = false; };
  }, [username, api]);
  // While the host is still setting the environment up, keep the status fresh so the user does not have to click again.
  useEffect(() => {
    if (!username || !api || !["queued", "starting", "routing", "waiting_capacity", "host_unreachable", "offline"].includes(state)) return;
    const timer = setInterval(() => { void api(false).then(setState).catch(() => {}); }, 15_000);
    return () => clearInterval(timer);
  }, [username, api, state]);
  if (!username || !api || state === "hidden") return [];
  const status: Record<string, string> = {
    available: lx("Yêu cầu khởi tạo", "Request setup"),
    queued: lx("Đang chờ máy chủ", "Queued"),
    starting: lx("Đang khởi động", "Starting"),
    running: open ? lx("Đang chạy · bấm để mở", "Running · click to open") : lx("Dịch vụ đang chạy", "Service running"),
    routing: lx("Đang cấp địa chỉ truy cập", "Setting up the address"),
    waiting_capacity: lx("Đang chờ tài nguyên", "Waiting for capacity"),
    host_unreachable: lx("Chưa nhận trạng thái từ máy chủ", "Host status overdue"),
    failed: lx("Khởi động thất bại", "Startup failed"),
    offline: lx("Chưa lấy được trạng thái", "Status unavailable"),
    opened: lx("Đã mở môi trường Cloud", "Cloud environment opened"),
    open_failed: lx("Chưa mở được, thử lại sau", "Could not open, try again"),
  };
  const select = () => {
    if ((state === "running" || state === "opened" || state === "open_failed") && open) {
      return open().then(setState).catch(() => setState("open_failed"));
    }
    return api(state === "available").then(setState).catch(() => setState("offline"));
  };
  return [{
    key: "limix-managed-beta", label: lx("Bot chạy trên Cloud (beta)", "Cloud-hosted bots (beta)"),
    subtitle: busy ? lx("Đang kiểm tra…", "Checking…") : status[state],
    keepOpen: true, disabled: busy, onSelect: () => {
      setBusy(true);
      void select().finally(() => setBusy(false));
    },
  }];
}
