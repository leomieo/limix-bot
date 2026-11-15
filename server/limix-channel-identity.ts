import { z } from "zod";
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

// oxlint-disable-next-line no-control-regex -- control characters are exactly what this refuses
const id = z.string().min(1).max(200).regex(/^[^\x00-\x1f]+$/);
export const channelConversationSchema = z.object({
  connectionId: id, platform: z.enum(["telegram", "zalo", "discord", "facebook"]),
  chatId: id, senderId: id, topicId: id.optional(), kind: z.enum(["private", "group"]),
}).strict().refine(value => value.kind !== "group" || value.senderId === "group");
export type ChannelConversation = z.infer<typeof channelConversationSchema>;
export function channelScope(value: ChannelConversation, owner: boolean): string {
  return JSON.stringify([value.platform, value.connectionId, value.kind, value.chatId, value.topicId ?? "", value.senderId, owner]);
}
export function parseChannelHeader(value: string | string[] | undefined): ChannelConversation | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid conversation identity");
  return channelConversationSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
}
/** Bindings are additional to Bot API authorization. A different sender cannot continue a bound transcript. */
export class ChannelIdentityRegistry {
  private records: Record<string, string>;
  private file: string;
  constructor(file: string) {
    this.file = file;
    this.records = existsSync(file) ? z.record(z.string(), z.string()).parse(JSON.parse(readFileSync(file, "utf8"))) : {};
  }
  matches(thread: string, identity: ChannelConversation | undefined, owner: boolean): boolean {
    const bound = this.records[thread];
    return identity ? bound === channelScope(identity, owner) : bound === undefined;
  }
  bind(thread: string, identity: ChannelConversation, owner: boolean): void {
    const scope = channelScope(identity, owner);
    if (this.records[thread] && this.records[thread] !== scope) throw new Error("Conversation identity mismatch");
    const next = { ...this.records, [thread]: scope };
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file + ".tmp", JSON.stringify(next), { mode: 0o600 });
    renameSync(this.file + ".tmp", this.file);
    this.records = next;
  }
}
