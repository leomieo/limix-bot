// Limix Bot: the bot's owner may talk to it from Telegram / Zalo / Discord with any AI, not only the ones that can run a
// confined guest turn. The connector (limix-gateway) sends X-Limix-Owner only for a sender the owner linked with /link,
// in a private chat; the secret is made per launch by the desktop app and never reaches an engine (deleted below,
// before any engine is started). An owner thread stays an owner thread: a guest's call can never continue it.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "./config.ts";

// On a server the connector is this server's own sidecar (limix-gateway-sidecar.ts): the server makes the secret.
const TOKEN = process.env.LIMIX_OWNER_LANE_TOKEN?.trim() || (process.env.LIMIX_GATEWAY_SIDECAR === "1" ? randomBytes(32).toString("base64url") : "");
delete process.env.LIMIX_OWNER_LANE_TOKEN;

/** The secret, for the sidecar connector only (never for an engine). */
export const limixOwnerLaneToken = (): string => (process.env.LIMIX_GATEWAY_SIDECAR === "1" ? TOKEN : "");

export const LIMIX_OWNER_HEADER = "x-limix-owner";

export function limixOwnerCall(header: string | string[] | undefined): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(TOKEN) || typeof header !== "string") return false;
  const a = Buffer.from(header), b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const MAX_THREADS = 5_000;
let threads: Set<string> | null = null;
const file = () => join(DATA_DIR, "limix-owner-threads.json");

function loaded(): Set<string> {
  if (threads) return threads;
  threads = new Set();
  try {
    const saved: unknown = JSON.parse(readFileSync(file(), "utf8"));
    if (Array.isArray(saved)) for (const id of saved) if (typeof id === "string") threads.add(id);
  } catch {
    // No owner threads yet.
  }
  return threads;
}

export function isLimixOwnerThread(threadId: string): boolean {
  return loaded().has(threadId);
}

export function markLimixOwnerThread(threadId: string): void {
  const all = loaded();
  if (all.has(threadId)) return;
  all.add(threadId);
  try {
    writeFileSync(file(), JSON.stringify([...all].slice(-MAX_THREADS)));
  } catch {
    // Kept in memory for this launch.
  }
}
