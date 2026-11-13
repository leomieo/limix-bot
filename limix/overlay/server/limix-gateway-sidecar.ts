// Limix Bot on a server (Docker image, LIMIX_GATEWAY_SIDECAR=1): the Telegram / Zalo / Discord connector
// (limix/gateway) runs beside the server, so the bots keep answering while every computer is off. On the desktop the
// app runs the connector itself (electron/limix-gateway.mjs) and this file does nothing.
//
// The connector listens only on 127.0.0.1:8790 inside the machine. Its page is reached through this server at
// /api/limix/gateway/, behind the server's own sign-in (a paired device or the loopback owner): the server adds the
// connector's admin token to each call, so the token never has to be typed or shared.
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";

import { DATA_DIR } from "./config.ts";
import { limixOwnerLaneToken } from "./limix-owner-lane.ts";

const GATEWAY_PORT = Number(process.env.LIMIX_GATEWAY_PORT) || 8790;
const PREFIX = "/api/limix/gateway";
const ADMIN = randomBytes(24).toString("base64url");
let child: ChildProcess | null = null;
let stopping = false;
let restarts = 0;

export const limixGatewaySidecarOn = (): boolean => process.env.LIMIX_GATEWAY_SIDECAR === "1";

function entry(): string | null {
  const candidates = [process.env.LIMIX_GATEWAY_ENTRY, "/app/limix-gateway/src/main.mjs", join(process.cwd(), "limix", "gateway", "src", "main.mjs")];
  return candidates.find((candidate): candidate is string => Boolean(candidate && existsSync(candidate))) ?? null;
}

/** Starts the connector once; it is started again (up to 20 times, waiting longer each time) when it stops. */
export function startLimixGatewaySidecar({ port, webhookPort }: { port: number; webhookPort: number }): void {
  if (!limixGatewaySidecarOn() || child || stopping) return;
  const main = entry();
  if (!main) { console.log("limix gateway: not in this image"); return; }
  const dataDir = join(DATA_DIR, "limix-gateway");
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const owner = limixOwnerLaneToken();
  child = spawn(process.execPath, [main], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, TZ: process.env.TZ, NODE_ENV: "production",
      LIMIX_DATA_DIR: dataDir, LIMIX_PORT: String(GATEWAY_PORT), LIMIX_NO_BROWSER: "1", LIMIX_ADMIN_TOKEN: ADMIN,
      LIMIX_SERVER_URL: `http://127.0.0.1:${port}`, LIMIX_BOT_API_URL: `http://127.0.0.1:${webhookPort}`,
      ...(owner ? { LIMIX_OWNER_LANE_TOKEN: owner } : {}),
    },
  });
  const note = (chunk: Buffer) => { const line = String(chunk).trim().split("\n").pop(); if (line) console.log(`limix gateway: ${line.slice(0, 200)}`); };
  child.stdout?.on("data", note);
  child.stderr?.on("data", note);
  const started = Date.now();
  child.on("exit", (code) => {
    child = null;
    if (stopping) return;
    if (Date.now() - started > 10 * 60_000) restarts = 0; // ran a good while: a fresh failure, not a crash loop
    console.log(`limix gateway exited (${code})`);
    if (restarts++ < 20) setTimeout(() => startLimixGatewaySidecar({ port, webhookPort }), Math.min(60_000, 2000 * restarts)).unref();
  });
  const stop = () => { stopping = true; try { child?.kill(); } catch { /* gone */ } };
  process.once("exit", stop);
  process.once("SIGTERM", stop);
}

/** GET|POST /api/limix/gateway/… → the connector. False: not this route (or no sidecar here). */
export function proxyLimixGateway(req: IncomingMessage, res: ServerResponse, path: string): boolean {
  if (!limixGatewaySidecarOn() || (path !== PREFIX && !path.startsWith(`${PREFIX}/`))) return false;
  if (path === PREFIX) { res.writeHead(308, { location: `${PREFIX}/` }); res.end(); return true; }
  const rest = path.slice(PREFIX.length) || "/";
  const send = (status: number, error: string) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify({ error })); };
  // The server keeps the connector running; stopping it from its page would only make it start again.
  if (rest === "/api/shutdown") { send(403, "On a server the connector always runs. Remove a connection to stop it."); return true; }
  if (!["GET", "POST"].includes(req.method ?? "")) { send(405, "method not allowed"); return true; }
  const query = new URL(req.url ?? "/", "http://x").search;
  const upstream = httpRequest({
    host: "127.0.0.1", port: GATEWAY_PORT, method: req.method, path: rest + query, timeout: 30_000,
    headers: {
      host: `127.0.0.1:${GATEWAY_PORT}`, "x-limix-admin": ADMIN,
      ...(req.headers["content-type"] ? { "content-type": req.headers["content-type"] } : {}),
      ...(req.headers["content-length"] ? { "content-length": req.headers["content-length"] } : {}),
    },
  }, (reply) => {
    const headers: Record<string, string | string[]> = {};
    for (const name of ["content-type", "cache-control", "content-security-policy", "x-frame-options"]) {
      const value = reply.headers[name];
      if (value !== undefined) headers[name] = value;
    }
    res.writeHead(reply.statusCode ?? 502, headers);
    reply.pipe(res);
  });
  upstream.on("timeout", () => upstream.destroy(new Error("timeout")));
  upstream.on("error", () => { if (!res.headersSent) send(502, "The Telegram / Zalo / Discord connector is starting. Reload in a few seconds."); else res.end(); });
  req.pipe(upstream);
  return true;
}
