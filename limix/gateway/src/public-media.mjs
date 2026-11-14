import { randomBytes } from "node:crypto";
import { MAX_MEDIA_BYTES } from "./media.mjs";

export function publicBase(value) {
  if (!value) return "";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/" || !url.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal|test)$/.test(url.hostname) || /^\d+\./.test(url.hostname)) throw new Error("Cần địa chỉ HTTPS công khai, không kèm đường dẫn hoặc mật khẩu.");
  return url.origin;
}

/** Expiring bearer URLs, in memory only; no user-selected path is ever served. */
export class PublicMedia {
  constructor(now = () => Date.now()) { this.now = now; this.items = new Map(); }
  prune() { for (const [key, item] of this.items) if (item.expires <= this.now()) this.items.delete(key); }
  publish(base, attachment) {
    const origin = publicBase(base);
    if (!origin) throw new Error("Cần thiết lập địa chỉ HTTPS cho nền tảng tải media.");
    this.prune();
    const bytes = Buffer.from(attachment.data, "base64");
    const used = [...this.items.values()].reduce((sum, item) => sum + item.bytes.length, 0);
    if (!bytes.length || bytes.length > MAX_MEDIA_BYTES || used + bytes.length > 40 * 1024 * 1024) throw new Error("Kho gửi media tạm thời đã đầy.");
    const suffix = attachment.mime === "audio/aac" ? ".aac" : ".bin";
    const key = randomBytes(32).toString("hex") + suffix;
    const expires = this.now() + 5 * 60_000;
    this.items.set(key, { bytes, mime: attachment.mime, expires });
    const timer = setTimeout(() => this.items.delete(key), 5 * 60_000); timer.unref?.();
    return `${origin}/hooks/limix-media/${key}`;
  }
  serve(req, res, pathname) {
    if (!pathname.startsWith("/hooks/limix-media/")) return false;
    this.prune();
    const item = this.items.get(pathname.slice("/hooks/limix-media/".length));
    if (!item || !["GET", "HEAD"].includes(req.method)) { res.writeHead(404); res.end(); return true; }
    res.writeHead(200, { "Content-Type": item.mime, "Content-Length": item.bytes.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" });
    res.end(req.method === "HEAD" ? undefined : item.bytes);
    return true;
  }
}

export const publicMedia = new PublicMedia();
