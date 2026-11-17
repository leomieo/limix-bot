// Limix Bot: the owner's secret, made per launch by the desktop app and never given to an engine (deleted below, before
// any engine is started). It unlocks channel conversations for the owner, and marks a Bot API call as the owner's only for a
// connector the app itself starts and hands this secret; none ships with the app (the messaging gateway is a separate module,
// limix/modules/messaging-gateway), so no outside key can make a call the owner's. An owner thread stays an owner thread.
import { timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "./config.ts";

const TOKEN = process.env.LIMIX_OWNER_LANE_TOKEN?.trim() || "";
delete process.env.LIMIX_OWNER_LANE_TOKEN;

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
