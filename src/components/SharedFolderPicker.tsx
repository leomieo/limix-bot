import { useState } from "react";
import { cloudFilesBridge } from "@/lib/cloud-files";
import { lx } from "@/lib/limix-text";
import { api, useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { failureText, folderSize, refusalText } from "./FilesView";
import { ConfirmDialog } from "./ConfirmDialog";
import type { FolderCheck } from "../../electron/cloud-sync.mjs";

interface Folder {
  id: string;
  kind: "pc" | "bot";
  lent?: boolean;
  pcPath?: string;
  computerName?: string;
  cloudPath: string;
}

export function SharedFolderPicker({ value, disabled, onChoose }: {
  value?: string;
  disabled: boolean;
  onChoose: (path: string) => void;
}) {
  const cloud = useStore().state.config?.cloudHome === true;
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<FolderCheck | null>(null);
  const bridge = cloudFilesBridge();
  if (!cloud) {
    if (!bridge) return null;
    const pick = async () => {
      setBusy(true);
      setError("");
      try {
        const selected = await bridge.pickFolder();
        if (selected?.refusal === "already-shared") {
          const { shared } = await bridge.state();
          if (shared.some(folder => !folder.lent && folder.pcPath === selected.pcPath)) onChoose(selected.pcPath);
          else setError(refusalText(selected.refusal));
        } else if (selected?.refusal) setError(refusalText(selected.refusal));
        else setCheck(selected);
      } catch (cause) { setError(failureText(cause)); }
      finally { setBusy(false); }
    };
    const share = async () => {
      if (!check || busy) return;
      setBusy(true);
      try {
        await bridge.share(check.token);
        onChoose(check.pcPath);
      } catch (cause) { setError(failureText(cause)); }
      finally { setBusy(false); setCheck(null); }
    };
    return <div className="mt-2 space-y-2 text-[13px]">
      <button type="button" className="ui-button" disabled={disabled || busy} onClick={() => void pick()}>
        {lx("Chọn thư mục chia sẻ với My Cloud", "Choose a folder to share with My Cloud")}
      </button>
      {error && <p role="alert" className="text-danger">{error}</p>}
      {check && <ConfirmDialog open tone="neutral" pending={busy} title={t("files.share.title", { name: check.name })}
        body={t("files.share.body", { size: folderSize(check) })} confirmLabel={t("files.share.confirm")}
        onCancel={() => setCheck(null)} onConfirm={() => void share()} />}
    </div>;
  }
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ folders: Folder[] }>("/api/sync");
      setFolders(result.folders.filter(folder => folder.kind === "pc" && !folder.lent));
    } catch {
      setFolders(null);
      setError(lx("Chưa tải được thư mục chia sẻ. Hãy kiểm tra kết nối My Cloud rồi thử lại.", "Couldn't load shared folders. Check your My Cloud connection and try again."));
    } finally {
      setBusy(false);
    }
  };
  const label = lx("Chọn thư mục đã chia sẻ", "Choose a shared folder");
  return <div className="mt-2 space-y-2 text-[13px]">
    <button type="button" className="ui-button" disabled={disabled || busy} onClick={() => void load()}>{label}</button>
    {folders && (folders.length ? <select aria-label={label} className="block w-full rounded-lg bg-inset p-2" disabled={disabled || busy}
      value={folders.find(folder => folder.cloudPath === value)?.id ?? ""} onChange={event => {
        const folder = folders.find(item => item.id === event.target.value);
        if (folder) onChoose(folder.cloudPath);
      }}>
      <option value="" disabled>{label}</option>
      {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.computerName} · {folder.pcPath}</option>)}
    </select> : <p>{lx("Trên máy chứa tệp, mở mục Tệp và chia sẻ một thư mục với My Cloud.", "On the computer holding the files, open Files and share a folder with My Cloud.")}</p>)}
    {error && <p role="alert" className="text-danger">{error}</p>}
  </div>;
}
