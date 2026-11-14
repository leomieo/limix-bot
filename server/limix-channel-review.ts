import { randomBytes } from "node:crypto";
import { limixOwnerCall } from "./limix-owner-lane.ts";
import type { RouteContext } from "./routes/table.ts";
const grants = new Map<string, number>();
const tickets = new Map<string, number>();
export const channelReviewActive = (until: number) => until > Date.now() && [...grants.values()].includes(until);
export function channelReviewUntil(cookie: string | undefined): number {
  const token = /(?:^|; )limix_channel_review=([A-Za-z0-9_-]{43})(?:;|$)/.exec(cookie ?? "")?.[1];
  const until = token ? grants.get(token) ?? 0 : 0;
  return until > Date.now() ? until : 0;
}
export async function channelReviewRoute(ctx: RouteContext): Promise<boolean> {
  const { path, method, req, res, auth, json, readBody } = ctx;
  if (!path.startsWith("/api/limix/channel-review/")) return false;
  if (!auth.scopes.includes("admin") || method !== "POST") { json(res, 403, { error: "Administrator access required" }); return true; }
  for (const map of [grants, tickets]) for (const [key, expiry] of map) if (expiry <= Date.now()) map.delete(key);
  if (path.endsWith("/grant")) {
    if (!limixOwnerCall(req.headers["x-limix-owner"])) { json(res, 403, { error: "Password verification required" }); return true; }
    const token = randomBytes(32).toString("base64url"); tickets.set(token, Date.now() + 30000);
    json(res, 200, { token }); return true;
  }
  if (path.endsWith("/unlock")) {
    const body = await readBody(req, 4096);
    const token = body && typeof body.token === "string" ? body.token : "";
    if (!tickets.has(token)) { json(res, 403, { error: "Password verification expired" }); return true; }
    tickets.delete(token);
    const session = randomBytes(32).toString("base64url"), until = Date.now() + 5 * 60000;
    grants.set(session, until);
    res.setHeader("set-cookie", `limix_channel_review=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=300`);
    json(res, 200, { until }); return true;
  }
  const token = /(?:^|; )limix_channel_review=([A-Za-z0-9_-]{43})/.exec(req.headers.cookie ?? "")?.[1];
  if (token) grants.delete(token);
  res.setHeader("set-cookie", "limix_channel_review=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  json(res, 200, { locked: true }); return true;
}
