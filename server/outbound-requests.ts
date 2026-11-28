import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { writeFileAtomic } from "./atomic.ts";
import { randomUUID } from "node:crypto";
import type { ConnectorCall } from "../shared/outbound.ts";
import { describeTool } from "./activity.ts";

const savedSend = z.object({
  botId: z.string(),
  threadId: z.string(),
  connection: z.string(),
  expiresAt: z.number(),
  args: z.object({
    recipient_email: z.string().min(1),
    subject: z.string(),
    body: z.string(),
    user_id: z.literal("me").optional(),
    extra_recipients: z.array(z.string()).optional(),
    cc: z.array(z.string()).optional(),
  }).strict(),
});
export type SavedOutboundSend = z.infer<typeof savedSend>;

export function exactGmailSend(args: unknown): SavedOutboundSend["args"] | undefined {
  const parsed = savedSend.shape.args.safeParse(args);
  return parsed.success && JSON.stringify(parsed.data).length <= 400 ? parsed.data : undefined;
}

export class PendingOutboundSends {
  private readonly dir: string;

  constructor(dir: string) { this.dir = dir; }

  private path(requestId: string) {
    if (!/^[0-9a-f-]{36}$/.test(requestId)) throw new Error("Invalid outbound request ID");
    return join(this.dir, requestId + ".json");
  }

  save(requestId: string, send: SavedOutboundSend) {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    writeFileAtomic(this.path(requestId), JSON.stringify(send), { mode: 0o600 });
  }

  get(requestId: string, threadId: string): SavedOutboundSend | undefined {
    if (!/^[0-9a-f-]{36}$/.test(requestId)) return;
    try {
      const saved = savedSend.parse(JSON.parse(readFileSync(this.path(requestId), "utf8")));
      if (saved.threadId === threadId && saved.expiresAt > Date.now()) return saved;
      if (saved.expiresAt <= Date.now()) this.discard(requestId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  discard(requestId: string) {
    try { unlinkSync(this.path(requestId)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }

  claim(requestId: string) {
    const path = this.path(requestId);
    // Consume the pending record before talking to Gmail. An ambiguous result must never be retried automatically.
    renameSync(path, path + ".claimed");
    writeFileAtomic(path + ".claimed", "", { mode: 0o600 });
  }

  dispatching(requestId: string): boolean {
    return /^[0-9a-f-]{36}$/.test(requestId) && existsSync(this.path(requestId) + ".claimed");
  }

  complete(requestId: string) {
    unlinkSync(this.path(requestId) + ".claimed");
  }
}

export type OutboundAnswer = "allow" | "deny" | "timeout";

interface Held {
  botId: string;
  threadId: string;
  tool: string;
  settle: (answer: OutboundAnswer) => void;
  answered?: OutboundAnswer;
  timer: ReturnType<typeof setTimeout>;
}

export type OutboundResolution =
  | { claimed: false }
  | { claimed: true; state: "allowed" | "denied" }
  | { claimed: true; state: "already_settled"; behavior: OutboundAnswer };

export class OutboundRequestService {
  private held = new Map<string, Held>();

  open(input: { botId: string; threadId: string; tool: string; timeoutMs: number }): {
    requestId: string;
    answer: Promise<OutboundAnswer>;
  } {
    const requestId = randomUUID();
    let settle!: (answer: OutboundAnswer) => void;
    const answer = new Promise<OutboundAnswer>((resolve) => {
      settle = resolve;
    });
    const timer = setTimeout(() => this.settle(requestId, "timeout"), input.timeoutMs);
    timer.unref?.();
    this.held.set(requestId, { botId: input.botId, threadId: input.threadId, tool: input.tool, settle, timer });
    return { requestId, answer };
  }

  private settle(requestId: string, answer: OutboundAnswer): void {
    const entry = this.held.get(requestId);
    if (!entry || entry.answered) return;
    entry.answered = answer;
    clearTimeout(entry.timer);
    entry.settle(answer);
  }

  resolve(input: { threadId: string; requestId: string; behavior: "allow" | "deny" | "answer" }): OutboundResolution {
    const entry = this.held.get(input.requestId);
    if (!entry || entry.threadId !== input.threadId) return { claimed: false };
    if (entry.answered) return { claimed: true, state: "already_settled", behavior: entry.answered };
    const answer: OutboundAnswer = input.behavior === "allow" ? "allow" : "deny";
    this.settle(input.requestId, answer);
    return { claimed: true, state: answer === "allow" ? "allowed" : "denied" };
  }

  pending(threadId: string): string[] {
    return [...this.held.entries()]
      .filter(([, entry]) => entry.threadId === threadId && !entry.answered)
      .map(([requestId]) => requestId);
  }

  forget(requestId: string): void {
    const entry = this.held.get(requestId);
    if (entry) clearTimeout(entry.timer);
    this.held.delete(requestId);
  }
}

/** What a "Send on your behalf?" card shows: each app action and its arguments, cut at 400 characters. */
export function outboundCard(outboundCalls: ConnectorCall[]): { app: string | null; calls: { app: string | null; label: string }[]; summary: string } {
  const calls = outboundCalls.map((call) => {
    const { app, label } = describeTool(call.slug);
    return { app, label };
  });
  const summary = outboundCalls.map((call, index) => {
    const described = calls[index];
    const argsText = call.arguments === undefined ? "" : JSON.stringify(call.arguments);
    return `${described.app ? `${described.app} · ` : ""}${described.label}${argsText ? `\n${argsText.slice(0, 400)}${argsText.length > 400 ? "… [arguments truncated]" : ""}` : ""}`;
  }).join("\n\n");
  return { app: calls[0]?.app ?? null, calls, summary };
}
