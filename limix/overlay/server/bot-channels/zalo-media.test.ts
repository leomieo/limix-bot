import { zaloAdapter, type ZaloApi } from "./zalo.ts";
import type { ChannelMessage } from "./engine.ts";
import { afterEach, expect, it, vi } from "vitest";
import { fetchPublicPage } from "../wait-probes.ts";
import { deleteAttachment } from "../attachments.ts";
import { receiveZaloFile, receiveZaloMedia, zaloUpload } from "./zalo-media.ts";

vi.mock("../wait-probes.ts", () => ({ fetchPublicPage: vi.fn() }));
const url = new URL("https://photo-a.zadn.zdn.vn/fixture");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=", "base64");
const paths: string[] = [];
afterEach(() => { for (const path of paths.splice(0)) deleteAttachment(path); vi.resetAllMocks(); });

it.each([
  { photo: true, bytes: png, mime: "image/png" },
  { photo: false, bytes: Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex"), mime: "video/mp4" },
])("prepares received $mime for the model and for a Zalo reply", async ({ photo, bytes, mime }) => {
  vi.mocked(fetchPublicPage).mockResolvedValue({ ok: true, url, headers: {}, body: bytes });
  const attachment = await receiveZaloMedia(url.href, photo);
  paths.push(attachment.path);
  expect(attachment.mime).toBe(mime);
  expect(await zaloUpload(attachment)).toMatchObject({ data: bytes, metadata: { totalSize: bytes.length } });
});
it("round trips a regular file larger than the image limit with its original name", async () => {
  const bytes = Buffer.alloc(11 * 1024 * 1024, 0x61);
  vi.mocked(fetchPublicPage).mockResolvedValue({ ok: true, url, headers: {}, body: bytes });
  const attachment = await receiveZaloFile(url.href, "report.bin");
  paths.push(attachment.path);
  expect(attachment).toMatchObject({ kind: "file", name: "report.bin" });
  const upload = await zaloUpload(attachment);
  expect(upload.filename).toBe("report.bin");
  expect(upload.metadata.totalSize).toBe(bytes.length);
  expect(upload.data.equals(bytes)).toBe(true);
});

it("refuses other origins and invalid media", async () => {
  await expect(receiveZaloMedia("http://127.0.0.1/file", true)).rejects.toThrow();
  expect(fetchPublicPage).not.toHaveBeenCalled();
  vi.mocked(fetchPublicPage).mockResolvedValue({ ok: true, url, headers: {}, body: Buffer.from("not media") });
  await expect(receiveZaloMedia(url.href, false)).rejects.toThrow();
});

it.each(["chat.photo", "chat.video.msg", "share.file"])("receives and sends %s through the Zalo session", async msgType => {
  const handlers = new Map<string, (event: unknown) => void>();
  const sendMessage = vi.fn(async () => ({}));
  const api = { getOwnId: () => "bot", listener: {
    on: (name: string, fn: (event: unknown) => void) => handlers.set(name, fn), start() {}, stop() {},
  }, sendMessage } as unknown as ZaloApi;
  const adapter = zaloAdapter(async () => ({ login: async () => api, loginQR: async () => api }));
  const abort = new AbortController();
  const delivered: ChannelMessage[] = [];
  const session = await adapter.open("{}", { botId: "fixture", signal: abort.signal, offset: 0, healthy() {}, saveOffset() {}, deliver: m => delivered.push(m) });
  try {
    const bytes = msgType === "chat.photo" ? png : msgType === "share.file" ? Buffer.from("a,b\n1,2") : Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex");
    vi.mocked(fetchPublicPage).mockResolvedValue({ ok: true, url, headers: {}, body: bytes });
    handlers.get("message")!({ type: 0, threadId: "friend", isSelf: false, data: { uidFrom: "friend", msgId: "1", msgType, content: { href: url.href, ...(msgType === "share.file" ? { title: "report.csv" } : {}) } } });
    expect(fetchPublicPage).not.toHaveBeenCalled();
    const message = delivered[0]!;
    const attachment = await message.loadMedia!();
    paths.push(attachment.path);
    await session.sendMedia!(message.chatId, attachment);
    expect(sendMessage).toHaveBeenCalledWith({ msg: "", attachments: expect.objectContaining({ data: bytes }) }, "friend", 0);
  } finally { abort.abort(); await session.done; }
});
