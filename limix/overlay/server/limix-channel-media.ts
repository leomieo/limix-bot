import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { z } from "zod";
import { ATTACHMENTS_DIR, deleteAttachment, saveFile, saveImage } from "./attachments.ts";
import type { Message } from "./store.ts";

export const CHANNEL_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const channelAttachmentSchema = z.object({
  name: z.string().min(1).max(200).refine((s) => !/[\\/\x00-\x1f]/.test(s), "Use a filename, not a path"),
  mime: z.string().min(1).max(128),
  data: z.string().min(4).max(Math.ceil(CHANNEL_MEDIA_MAX_BYTES / 3) * 4).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
export type ChannelAttachment = z.infer<typeof channelAttachmentSchema>;

const attribute = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function saveChannelAttachments(items: ChannelAttachment[]) {
  if (items.reduce((sum, item) => sum + Buffer.byteLength(item.data, "base64"), 0) > CHANNEL_MEDIA_MAX_BYTES) {
    throw Object.assign(new Error("Attachments exceed 10 MB per message"), { status: 413, forCaller: true });
  }
  const saved: NonNullable<Message["attachments"]> = [];
  try {
    for (const item of items) {
      const bytes = Buffer.from(item.data, "base64");
      if (item.mime.startsWith("image/")) {
        saved.push({ ...saveImage(bytes, item.mime), kind: "image", name: item.name });
      } else {
        const stream = async function* () { yield bytes; };
        saved.push({ ...await saveFile(stream(), item.name, item.mime), kind: "file" });
      }
    }
    return { saved, tags: saved.map((item) => `<attached-${item.kind === "image" ? "image" : "file"} path="${attribute(item.path)}" name="${attribute("name" in item ? item.name ?? "attachment" : "attachment")}" />`).join("\n") };
  } catch (error) {
    for (const item of saved) deleteAttachment(item.path);
    throw error;
  }
}

/** Export only attachments explicitly emitted in this API reply, never paths mentioned in prose or tool results. */
export function channelReplyAttachments(lines: readonly Message[]) {
  const attachments: Array<ChannelAttachment & { size: number; kind: "image" | "audio" | "video" | "file" }> = [];
  let total = 0;
  let mediaError = false;
  for (const line of lines) {
    if (line.role !== "bot") continue;
    for (const item of line.attachments ?? []) {
      if ("fromTool" in item && item.fromTool) continue;
      try {
        const path = resolve(item.path);
        if (dirname(path) !== resolve(ATTACHMENTS_DIR) || lstatSync(path).isSymbolicLink() || dirname(realpathSync(path)) !== realpathSync(ATTACHMENTS_DIR)) throw new Error("not an attachment");
        const stat = lstatSync(path);
        if (!stat.isFile() || attachments.length >= 4 || total + stat.size > CHANNEL_MEDIA_MAX_BYTES) throw new Error("too large");
        const data = readFileSync(path);
        total += data.length;
        const prefix = item.mime.split("/")[0];
        const kind = prefix === "image" || prefix === "audio" || prefix === "video" ? prefix : "file";
        attachments.push({ name: "name" in item && item.name ? basename(item.name) : basename(path), mime: item.mime, kind, size: data.length, data: data.toString("base64") });
      } catch { mediaError = true; }
    }
  }
  return { ...(attachments.length ? { attachments } : {}), ...(mediaError ? { mediaError: true } : {}) };
}
