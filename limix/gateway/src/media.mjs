export const MEDIA_KINDS = ["image", "video", "audio", "file"];
const MB = 1024 * 1024;
/** One file, at most what each platform lets a bot fetch (receive) or upload (send) through its standard API. */
export const PLATFORM_MEDIA_LIMITS = Object.freeze({
  telegram: { receive: 20 * MB, send: 50 * MB },
  discord: { receive: 25 * MB, send: 10 * MB },
  facebook: { receive: 25 * MB, send: 25 * MB },
  zalo: { receive: 10 * MB, send: 10 * MB },
});
const FALLBACK_LIMITS = { receive: 10 * MB, send: 10 * MB };
export const platformMediaLimits = (platform) => PLATFORM_MEDIA_LIMITS[platform] ?? FALLBACK_LIMITS;
/** All files in one message together: they travel in one request to Limix Bot. Any number of files fits under it. */
export const MAX_MEDIA_BYTES = 200 * MB;
/** maxCount 0: no limit on how many files a message carries. */
export const DEFAULT_MEDIA_POLICY = { receive: true, send: true, kinds: MEDIA_KINDS, maxBytes: 50 * MB, maxCount: 0 };

export function mediaPolicy(value = {}, platform) {
  const limits = platformMediaLimits(platform);
  const largest = Math.max(limits.receive, limits.send);
  const given = { ...DEFAULT_MEDIA_POLICY, ...value };
  // A connection saved under the old 10 MB / 4-file limits keeps working; an unset size means the platform's largest.
  const policy = { ...given, maxBytes: value.maxBytes === undefined ? largest : given.maxBytes };
  if (typeof policy.receive !== "boolean" || typeof policy.send !== "boolean" ||
      !Array.isArray(policy.kinds) || policy.kinds.some((k) => !MEDIA_KINDS.includes(k)) ||
      !Number.isInteger(policy.maxBytes) || policy.maxBytes < 1024 || policy.maxBytes > largest ||
      !Number.isInteger(policy.maxCount) || policy.maxCount < 0 || policy.maxCount > 1000) {
    throw Object.assign(new Error(`Thiết lập tệp không hợp lệ (mỗi tệp tối đa ${Math.round(largest / MB)} MB với nền tảng này).`), { status: 400 });
  }
  return { receive: policy.receive, send: policy.send, kinds: [...new Set(policy.kinds)], maxBytes: policy.maxBytes, maxCount: policy.maxCount };
}

export function mediaKind(mime = "") {
  const prefix = mime.split("/")[0];
  return ["image", "video", "audio"].includes(prefix) ? prefix : "file";
}

export function checkMedia(items, policy, direction, platform) {
  if (!items?.length) return;
  if (!policy[direction]) throw new Error(direction === "receive" ? "Kết nối này đã tắt nhận tệp." : "Kết nối này đã tắt gửi tệp.");
  if (policy.maxCount > 0 && items.length > policy.maxCount) throw new Error(`Mỗi tin chỉ nhận/gửi tối đa ${policy.maxCount} tệp.`);
  const perFile = Math.min(policy.maxBytes, platformMediaLimits(platform)[direction]);
  let total = 0;
  for (const item of items) {
    if (!policy.kinds.includes(item.kind ?? mediaKind(item.mime))) throw new Error("Loại tệp này đã bị tắt trong thiết lập kết nối.");
    const actualSize = item.data ? Buffer.byteLength(item.data, "base64") : Number(item.size ?? 0);
    total += actualSize;
    if (actualSize > perFile) throw new Error(`Tệp vượt giới hạn ${Math.round(perFile / (1024 * 1024))} MB mỗi tệp.`);
  }
  if (total > MAX_MEDIA_BYTES) throw new Error("Tổng tệp trong một tin vượt 200 MB.");
}

/** Only platform-owned HTTPS origins; redirects never carry a credential or bypass the host allowlist. */
export async function downloadMedia(url, { hosts, maxBytes, fetchImpl = fetch }) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443") ||
      !hosts.some((host) => parsed.hostname === host || (host.startsWith(".") && parsed.hostname.endsWith(host)))) {
    throw new Error("Địa chỉ tệp không thuộc máy chủ media được cho phép.");
  }
  const res = await fetchImpl(parsed, { redirect: "error", signal: AbortSignal.timeout(120_000) });
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

export async function receiveMedia(channel, items, policy, platform) {
  checkMedia(items, policy, "receive", platform);
  const perFile = Math.min(policy.maxBytes, platformMediaLimits(platform).receive);
  const result = [];
  let remaining = MAX_MEDIA_BYTES;
  for (const item of items ?? []) {
    const loaded = await channel.downloadAttachment(item, Math.min(perFile, remaining));
    remaining -= loaded.size;
    const attachment = { ...loaded, name: item.name || `attachment.${loaded.mime.split("/")[1] || "bin"}`, kind: mediaKind(loaded.mime) };
    checkMedia([attachment], policy, "receive", platform);
    result.push(attachment);
  }
  return result;
}
