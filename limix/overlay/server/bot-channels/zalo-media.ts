import { Readable } from "node:stream";
import { imageDimensions } from "../../shared/provider-icon.ts";
import { IMAGE_MAX_BYTES, saveFile, saveImage } from "../attachments.ts";
import { fetchPublicPage } from "../wait-probes.ts";
import { fetchChannelMedia, readChannelMedia, type ChannelMedia } from "./channel-media.ts";

const ZALO_FILE_LIMIT = 32 * 1024 * 1024;
const ZALO_CDN = ["zaloapp.com", "zalo.me", "zdn.vn", "zadn.vn", "zalo.vn"];

export function receiveZaloFile(url: string, name: string) {
  return fetchChannelMedia(url, ZALO_CDN, name, ZALO_FILE_LIMIT);
}

export async function receiveZaloMedia(url: string, photo: boolean): Promise<ChannelMedia> {
  const limit = photo ? IMAGE_MAX_BYTES : ZALO_FILE_LIMIT;
  const target = new URL(url);
  if (target.protocol !== "https:" || !/(^|\.)(zaloapp\.com|zalo\.me|zdn\.vn|zadn\.vn|zalo\.vn)$/.test(target.hostname)) throw Error("Unsupported Zalo media address");
  const page = await fetchPublicPage(url, { maxBytes: limit + 1, timeoutMs: 30000, maxRedirects: 0 });
  if (!page.ok || !page.body.length || page.body.length > limit) throw Error("Zalo media unavailable");
  if (photo) {
    const mime = ["image/jpeg", "image/png", "image/webp"].find(type => imageDimensions(page.body, type));
    if (!mime) throw Error("Unsupported image");
    const { path } = saveImage(page.body, mime);
    return { kind: "image", path, mime };
  }
  if (page.body.toString("ascii", 4, 8) !== "ftyp") throw Error("Unsupported video");
  const file = await saveFile(Readable.from([page.body]), "video.mp4", "video/mp4", { expectedBytes: page.body.length });
  return { kind: "file", path: file.path, name: file.name, mime: file.mime };
}

export async function zaloUpload(file: ChannelMedia) {
  const { data, filename } = await readChannelMedia(file, file.kind === "image" ? IMAGE_MAX_BYTES : ZALO_FILE_LIMIT);
  const dimensions = file.kind === "image" ? imageDimensions(data, file.mime) : undefined;
  if (file.kind === "image" && !dimensions) throw Error("Unsupported image");
  return { data, filename, metadata: { ...dimensions, totalSize: data.length } };
}
