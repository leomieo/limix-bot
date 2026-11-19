import { useEffect, useState } from "react";
import { lx } from "@/lib/limix-text";
import { api, ApiError } from "@/state/api";
import { useStore } from "@/state/store";

interface GrantState {
  enabled: boolean;
  inherited: boolean;
  canEnable: boolean;
  folder: string | null;
  canRefresh?: boolean;
  currentBots?: number;
  grantedBots?: number;
}

export function VmWorkingFolderAccess({ kind, id, folder, members }: {
  kind: "bots" | "groups";
  id: string;
  folder?: string;
  members?: string;
}) {
  const [grant, setGrant] = useState<GrantState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `/api/${kind}/${encodeURIComponent(id)}/vm-working-folder`;
  const cloudHome = useStore().state.config?.cloudHome === true;
  const available = !cloudHome && Boolean(window.ogb?.pickFolder);
  useEffect(() => {
    if (!available) return;
    const controller = new AbortController();
    void api<GrantState>(path, { signal: controller.signal }).then((state) => {
      if (!controller.signal.aborted) setGrant(state);
    }).catch(() => {});
    return () => controller.abort();
  }, [available, folder, members, path]);
  if (!available || !grant) return null;
  const granted = grant.enabled || grant.inherited;
  if (!folder && !granted) return null;
  const save = async (enabled: boolean) => {
    setSaving(true);
    setError(null);
    try {
      setGrant(await api<GrantState>(path, { method: "PUT", body: JSON.stringify({ enabled, folder }) }));
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.body?.code : undefined;
      setError(code === "stop" ? lx("Mở Docker và tắt các desktop liên quan trước khi đổi quyền.", "Start Docker and stop the affected desktops before changing access.")
        : code === "overlap" ? lx("Một bot đã có quyền vào thư mục khác. Thu hồi quyền đó trước.", "A bot already has a folder grant. Revoke it first.")
        : code === "folder" ? lx("Hãy chọn thư mục dự án riêng đang tồn tại.", "Choose an existing, dedicated project folder.")
        : lx("Chưa lưu được quyền. Hãy kiểm tra thư mục làm việc và thử lại.", "Couldn't save access. Check the working folder and try again."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-hairline/50 p-3 text-[13px]">
      <div className="font-medium text-ink">{lx("Cho máy ảo sử dụng thư mục này", "Share this folder with the virtual desktop")}</div>
      <p className="text-ink-secondary">
        {granted
          ? lx("Đã cấp quyền. Mở tab Máy tính và thay thế desktop hiện có để áp dụng. Trong desktop, mở /home/cua/project.", "Access granted. Open the computer tab and replace any existing desktop to apply it. In the desktop, open /home/cua/project.")
          : lx("Máy ảo có thể đọc, ghi và xóa trực tiếp trên máy bạn sau khi bạn cấp quyền.", "The virtual desktop can read, write, and delete files directly on your computer after you grant access.")}
      </p>
      {grant.folder && <p className="break-all font-mono text-ink-secondary">{grant.folder}</p>}
      {kind === "groups" && <p className="text-ink-secondary">{granted
        ? lx(`Đã cấp cho ${grant.grantedBots} bot. Khi đổi thành viên, bấm Cập nhật thành viên để cấp lại theo danh sách hiện tại.`, `Granted to ${grant.grantedBots} bots. After membership changes, update the grant to match the current list.`)
        : lx(`Cấp quyền cho ${grant.currentBots} bot hiện có trong nhóm.`, `Grant access to the room’s ${grant.currentBots} current bots.`)}</p>}
      {!granted && !grant.canEnable && <p className="text-ink-secondary">{lx("Chọn thư mục và bật chế độ desktop riêng cho từng bot.", "Choose a folder and enable private desktops for each bot.")}</p>}
      <button type="button" disabled={saving || (!granted && !grant.canEnable)} onClick={() => void save(!granted)}
        className="rounded-lg bg-control px-3 py-2 font-medium text-ink hover:bg-raised-hover disabled:opacity-50">
        {granted ? lx("Thu hồi quyền", "Revoke access") : lx("Cấp quyền đọc, ghi và xóa", "Grant read, write, and delete access")}
      </button>
      {grant.canRefresh && grant.canEnable && <button type="button" disabled={saving} onClick={() => void save(true)}
        className="ml-2 rounded-lg bg-control px-3 py-2 font-medium text-ink hover:bg-raised-hover disabled:opacity-50">
        {lx("Cập nhật thành viên", "Update members")}
      </button>}
      {error && <p role="alert" className="text-danger">{error}</p>}
    </div>
  );
}
