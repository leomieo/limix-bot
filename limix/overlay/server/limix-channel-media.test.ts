import { expect, it } from "vitest";
import { CHANNEL_MEDIA_MAX_BYTES, channelAttachmentSchema } from "./limix-channel-media.ts";

it("takes a Telegram-sized file in one message, and holds the whole message to 200 MB", () => {
  expect(CHANNEL_MEDIA_MAX_BYTES).toBe(200 * 1024 * 1024);
  const fifty = Buffer.alloc(50 * 1024 * 1024, 1).toString("base64");
  expect(channelAttachmentSchema.safeParse({ name: "video.mp4", mime: "video/mp4", data: fifty }).success).toBe(true);
  expect(channelAttachmentSchema.safeParse({ name: "../x", mime: "video/mp4", data: "AAAA" }).success).toBe(false);
  for (const bad of ["AAA", "AA=A", "AA*A", "A==="]) expect(channelAttachmentSchema.safeParse({ name: "f", mime: "text/plain", data: bad }).success, bad).toBe(false);
  expect(channelAttachmentSchema.safeParse({ name: "f", mime: "text/plain", data: "QUI=" }).success).toBe(true);
});
