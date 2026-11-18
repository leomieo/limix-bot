import { lstat, readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { Readable } from "node:stream";
import { imageDimensions } from "../../shared/provider-icon.ts";
import { ATTACHMENTS_DIR, IMAGE_MAX_BYTES, sanitizeSharedFileName, saveFile, saveImage } from "../attachments.ts";
import type { BotAttachment } from "../bot-attachment.ts";
import { mimeFor } from "../message-file.ts";
import { fetchPublicPage } from "../wait-probes.ts";

export type ChannelMedia = Extract<BotAttachment, { kind: "file" | "image" }>;
export const CHANNEL_FILE_LIMIT = 10 * 1024 * 1024;
const imageTypes = ["image/jpeg", "image/png", "image/webp"];

export async function storeChannelMedia(bytes: Buffer, name: string, limit = CHANNEL_FILE_LIMIT): Promise<ChannelMedia> {
  if (!bytes.length || bytes.length > limit) throw Error("Attachment size is unsupported");
  const mime = bytes.length <= IMAGE_MAX_BYTES ? imageTypes.find(type => imageDimensions(bytes, type)) : undefined;
  if (mime) {
    const file = saveImage(bytes, mime);
    return { kind: "image", path: file.path, mime, name: sanitizeSharedFileName(name, mime) };
  }
  const stored = await saveFile(Readable.from([bytes]), name, mimeFor(name), { expectedBytes: bytes.length });
  return { kind: "file", path: stored.path, name: stored.name, mime: stored.mime };
}

export async function fetchChannelMedia(url: string, domains: readonly string[], name: string, limit = CHANNEL_FILE_LIMIT) {
  const target = new URL(url);
  if (target.protocol !== "https:" || target.port || !domains.some(domain => target.hostname === domain || target.hostname.endsWith("." + domain))) {
    throw Error("Unsupported attachment address");
  }
  const page = await fetchPublicPage(url, { maxBytes: limit + 1, timeoutMs: 30_000, maxRedirects: 0 });
  if (!page.ok || page.headers["content-type"]?.startsWith("text/html")) throw Error("Attachment unavailable");
  return storeChannelMedia(page.body, name, limit);
}

export async function readChannelMedia(file: ChannelMedia, limit = CHANNEL_FILE_LIMIT) {
  if (dirname(file.path) !== ATTACHMENTS_DIR || !/^[0-9a-f-]{36}\.[a-z0-9]{1,10}$/i.test(basename(file.path))) {
    throw Error("Unsupported attachment path");
  }
  const stat = await lstat(file.path);
  if (!stat.isFile() || !stat.size || stat.size > limit) throw Error("Attachment size is unsupported");
  const data = await readFile(file.path);
  if (data.length > limit) throw Error("Attachment size is unsupported");
  return { data, filename: sanitizeSharedFileName(file.name ?? basename(file.path), file.mime), mime: file.mime };
}

export function channelFileBlob(file: Awaited<ReturnType<typeof readChannelMedia>>): Blob {
  return new Blob([Uint8Array.from(file.data)], { type: file.mime });
}

export async function readChannelDownload(response: Response): Promise<Buffer> {
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > CHANNEL_FILE_LIMIT) {
    await response.body?.cancel();
    throw Error("Attachment unavailable");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, size);
      size += value.length;
      if (size > CHANNEL_FILE_LIMIT) throw Error("Attachment size is unsupported");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
