export const MEDIA_KINDS = ["image", "video", "audio", "file"];
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MEDIA_POLICY = { receive: true, send: true, kinds: MEDIA_KINDS, maxBytes: MAX_MEDIA_BYTES, maxCount: 4 };

export function mediaPolicy(value = {}) {
  const policy = { ...DEFAULT_MEDIA_POLICY, ...value };
  if (typeof policy.receive !== "boolean" || typeof policy.send !== "boolean" ||
      !Array.isArray(policy.kinds) || policy.kinds.some((k) => !MEDIA_KINDS.includes(k)) ||
      !Number.isInteger(policy.maxBytes) || policy.maxBytes < 1024 || policy.maxBytes > MAX_MEDIA_BYTES ||
      !Number.isInteger(policy.maxCount) || policy.maxCount < 1 || policy.maxCount > 4) {
    throw Object.assign(new Error("Thiết lập tệp không hợp lệ (tối đa 10 MB và 4 tệp mỗi tin)."), { status: 400 });
  }
  return { receive: policy.receive, send: policy.send, kinds: [...new Set(policy.kinds)], maxBytes: policy.maxBytes, maxCount: policy.maxCount };
}

export function mediaKind(mime = "") {
  const prefix = mime.split("/")[0];
  return ["image", "video", "audio"].includes(prefix) ? prefix : "file";
}

export function checkMedia(items, policy, direction) {
  if (!items?.length) return;
  if (!policy[direction]) throw new Error(direction === "receive" ? "Kết nối này đã tắt nhận tệp." : "Kết nối này đã tắt gửi tệp.");
  if (items.length > policy.maxCount) throw new Error(`Mỗi tin chỉ nhận/gửi tối đa ${policy.maxCount} tệp.`);
  let total = 0;
  for (const item of items) {
    if (!policy.kinds.includes(item.kind ?? mediaKind(item.mime))) throw new Error("Loại tệp này đã bị tắt trong thiết lập kết nối.");
    const actualSize = item.data ? Buffer.byteLength(item.data, "base64") : Number(item.size ?? 0);
    total += actualSize;
    if (actualSize > policy.maxBytes) throw new Error("Tệp vượt giới hạn dung lượng của kết nối.");
  }
  if (total > MAX_MEDIA_BYTES) throw new Error("Tổng tệp trong một tin vượt 10 MB.");
}

/** Only platform-owned HTTPS origins; redirects never carry a credential or bypass the host allowlist. */
export async function downloadMedia(url, { hosts, maxBytes, fetchImpl = fetch }) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443") ||
      !hosts.some((host) => parsed.hostname === host || (host.startsWith(".") && parsed.hostname.endsWith(host)))) {
    throw new Error("Địa chỉ tệp không thuộc máy chủ media được cho phép.");
  }
  const res = await fetchImpl(parsed, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!res.ok || !res.body) throw new Error("Không tải được tệp từ nền tảng.");
  if (Number(res.headers.get("content-length")) > maxBytes) { await res.body.cancel(); throw new Error("Tệp vượt giới hạn dung lượng."); }
  const chunks = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("Tệp vượt giới hạn dung lượng.");
    chunks.push(chunk);
  }
  if (!size) throw new Error("Tệp rỗng.");
  return { data: Buffer.concat(chunks).toString("base64"), size, mime: res.headers.get("content-type")?.split(";")[0] || "application/octet-stream" };
}

export async function receiveMedia(channel, items, policy) {
  checkMedia(items, policy, "receive");
  const result = [];
  let remaining = MAX_MEDIA_BYTES;
  for (const item of items ?? []) {
    const loaded = await channel.downloadAttachment(item, Math.min(policy.maxBytes, remaining));
    remaining -= loaded.size;
    const attachment = { ...loaded, name: item.name || `attachment.${loaded.mime.split("/")[1] || "bin"}`, kind: mediaKind(loaded.mime) };
    checkMedia([attachment], policy, "receive");
    result.push(attachment);
  }
  return result;
}
