import { expect, it, vi } from "vitest";
vi.mock("./limix-owner-lane.ts", async (importOriginal) => ({ ...await importOriginal<typeof import("./limix-owner-lane.ts")>(), limixOwnerCall: (value: unknown) => value === "trusted-main" }));
import { markLimixOwnerThread } from "./limix-owner-lane.ts";
import { channelReviewRoute, channelReviewUntil, channelReviewActive } from "./limix-channel-review.ts";
import { VisibleSet, memberBot } from "./bot-visibility.ts";
import type { RouteContext } from "./routes/table.ts";
async function request(path: string, body = {}, headers = {}) {
  let output: any; const sent: Record<string, string> = {};
  await channelReviewRoute({ path: "/api/limix/channel-review/" + path, method: "POST", req: { headers }, res: { setHeader: (name: string, value: string) => { sent[name] = value; } }, auth: { kind: "loopback", scopes: ["admin"] }, readBody: async () => body, json: (_: unknown, status: number, value: unknown) => { output = { status, value }; } } as unknown as RouteContext);
  return { ...output, headers: sent };
}
it("requires trusted password verification, consumes tickets once and locks on expiry/revocation", async () => {
  expect((await request("grant")).status).toBe(403);
  const grant = await request("grant", {}, { "x-limix-owner": "trusted-main" });
  const unlocked = await request("unlock", grant.value);
  expect(unlocked.status).toBe(200);
  const cookie = unlocked.headers["set-cookie"];
  expect(cookie).toContain("HttpOnly; SameSite=Strict");
  expect(channelReviewUntil(cookie)).toBe(unlocked.value.until);
  expect(channelReviewActive(unlocked.value.until)).toBe(true);
  expect((await request("unlock", grant.value)).status).toBe(403);
  await request("lock", {}, { cookie });
  expect(channelReviewUntil(cookie)).toBe(0);
  expect(channelReviewActive(unlocked.value.until)).toBe(false);
  vi.useFakeTimers();
  try {
    const ticket = (await request("grant", {}, { "x-limix-owner": "trusted-main" })).value;
    vi.advanceTimersByTime(31000);
    expect((await request("unlock", ticket)).status).toBe(403);
  } finally { vi.useRealTimers(); }
});
it("hides channel titles and selected transcript from locked admin, including legacy API chats", () => {
  const bot = { id: "bot", threadId: "external", mainThreadId: "local", tasks: [{ threadId: "local", title: "Configuration" }, { threadId: "external", botApi: true as const, title: "secret customer" }], messages: [{ text: "secret text" }] };
  const locked = new VisibleSet([bot], [], { kind: "all" });
  expect(locked.filtersThreads).toBe(true);
  expect(locked.thread("external")).toBe(false);
  const out = memberBot(bot, locked);
  expect(JSON.stringify(out)).not.toMatch(/secret/);
  expect(out.threadId).toBe("local");
  const until = Date.now() + 300000;
  const unlocked = new VisibleSet([bot], [], { kind: "all", channelReviewUntil: until });
  expect(unlocked.thread("external")).toBe(true);
});
it("keeps the bot owner's own channel chat listed while other people's stay locked", () => {
  markLimixOwnerThread("owner-chat");
  const bot = { id: "bot", threadId: "local", mainThreadId: "local", tasks: [{ threadId: "local", title: "Configuration" }, { threadId: "owner-chat", botApi: true as const, title: "Telegram · owner" }, { threadId: "guest-chat", botApi: true as const, title: "Telegram · guest" }] };
  const locked = new VisibleSet([bot], [], { kind: "all" });
  expect(locked.thread("owner-chat")).toBe(true);
  expect(locked.thread("guest-chat")).toBe(false);
  expect(JSON.stringify(memberBot(bot, locked))).toContain("Telegram · owner");
  expect(JSON.stringify(memberBot(bot, locked))).not.toContain("Telegram · guest");
});
