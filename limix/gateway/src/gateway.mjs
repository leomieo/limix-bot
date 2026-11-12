// Runs one polling consumer per enabled connection and hands accepted messages to the router.
// Security invariant: a connection never takes over a bot that another consumer (webhook or poller) holds.
import { EchoEngine, OpenMausBotEngine } from "./engines/openmausbot.mjs";
import { TelegramChannel } from "./channels/telegram.mjs";
import { DiscordChannel } from "./channels/discord.mjs";
import { ZaloChannel } from "./channels/zalo.mjs";
import { Router, TEXT } from "./router.mjs";

const sleep = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
});

export const PLATFORMS = {
  telegram: (opts) => new TelegramChannel(opts),
  zalo: (opts) => new ZaloChannel(opts),
  discord: (opts) => new DiscordChannel(opts),
};

export function defaultMakeChannel(conn, token, overrides = {}) {
  const make = PLATFORMS[conn.platform];
  if (!make) throw new Error(`Nền tảng chưa hỗ trợ: ${conn.platform}`);
  return make({ token, ...(overrides[conn.platform] ?? {}) });
}

export function defaultMakeEngine(conn, secrets) {
  if (conn.engine?.kind === "openmausbot") {
    return new OpenMausBotEngine({ endpoint: conn.engine.endpoint, apiKey: secrets.get(conn.engine.keyRef) });
  }
  return new EchoEngine();
}

export class Gateway {
  constructor({ store, secrets, pairing, makeChannel = defaultMakeChannel, makeEngine = defaultMakeEngine }) {
    this.store = store;
    this.secrets = secrets;
    this.pairing = pairing;
    this.makeChannel = makeChannel;
    this.makeEngine = makeEngine;
    this.router = new Router({ store, pairing });
    this.running = new Map();
    this.interrupted = store.takeInterrupted();
  }

  startAll() {
    for (const conn of this.store.listConnections()) if (conn.enabled) this.start(conn.id);
  }

  isRunning(id) {
    return this.running.has(id);
  }

  start(id) {
    if (this.running.has(id)) return;
    const conn = this.store.getConnection(id);
    if (!conn) return;
    const controller = new AbortController();
    const done = this.loop(conn, controller.signal).catch((error) => {
      this.setStatus(id, error.code === "credential_invalid" ? "credential_invalid" : "error", error.message);
    }).finally(() => this.running.delete(id));
    this.running.set(id, { controller, done });
  }

  async stop(id, status = "stopped") {
    const run = this.running.get(id);
    if (!run) return;
    run.controller.abort();
    await run.done;
    this.setStatus(id, status, "");
  }

  async stopAll() {
    await Promise.all([...this.running.keys()].map((id) => this.stop(id)));
  }

  setStatus(id, status, detail) {
    const conn = this.store.getConnection(id);
    if (!conn) return;
    if (conn.status !== status || conn.statusDetail !== detail) {
      this.store.updateConnection(id, { status, statusDetail: detail });
      this.store.log(id, "status", `${status}${detail ? `: ${detail}` : ""}`);
    }
  }

  async recheckEngine(id, engine, signal, { everyMs = 5_000, forMs = 5 * 60_000 } = {}) {
    const until = Date.now() + forMs;
    while (!signal.aborted && Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, everyMs));
      if (signal.aborted) return;
      const health = await engine.check();
      if (health.ok) {
        if (this.store.getConnection(id)?.status === "running") this.setStatus(id, "running", "");
        return;
      }
      if (health.code !== "engine_unreachable") {
        this.setStatus(id, "running", `Cảnh báo AI: ${health.message}`);
        return;
      }
    }
  }

  async loop(conn, signal) {
    const channel = this.makeChannel(conn, this.secrets.get(conn.tokenRef));
    const engine = this.makeEngine(conn, this.secrets);
    signal.addEventListener("abort", () => channel.close?.(), { once: true });
    this.setStatus(conn.id, "starting", "");

    const conflict = await channel.checkConflict();
    if (conflict.conflict) {
      this.setStatus(conn.id, "conflict", `${conflict.detail}. Limix không tự gỡ — hãy tắt chương trình kia hoặc xóa webhook rồi bấm Chạy lại.`);
      return;
    }
    const health = await engine.check();
    this.setStatus(conn.id, "running", health.ok ? "" : `Cảnh báo AI: ${health.message}`);
    // The connector starts before the app's own server is listening: an unreachable AI is checked again until it answers.
    if (!health.ok && health.code === "engine_unreachable") void this.recheckEngine(conn.id, engine, signal);

    for (const row of this.interrupted.filter((r) => r.connectionId === conn.id)) {
      await channel.sendText(row.chatId, TEXT.interrupted).catch(() => {});
    }

    let backoff = 1000;
    while (!signal.aborted) {
      try {
        const current = this.store.getConnection(conn.id);
        if (!current) return;
        const { events, cursor } = await channel.fetchUpdates(this.store.getCursor(conn.id));
        const accepted = events.filter((e) => this.store.acceptEvent({ ...e, connectionId: conn.id }));
        if (cursor !== undefined && cursor !== this.store.getCursor(conn.id)) this.store.setCursor(conn.id, cursor);
        for (const event of accepted) {
          this.router.handle({ conn: this.store.getConnection(conn.id), channel, engine, event });
        }
        if (backoff > 1000) this.setStatus(conn.id, "running", "");
        backoff = 1000;
      } catch (error) {
        if (signal.aborted) return;
        if (error.code === "connection_conflict") {
          this.setStatus(conn.id, "conflict", `${error.message}. Limix đã dừng để không tranh tin nhắn.`);
          return;
        }
        if (error.code === "credential_invalid") {
          this.setStatus(conn.id, "credential_invalid", error.message);
          return;
        }
        this.setStatus(conn.id, "degraded", error.message);
        await sleep(error.retryAfterMs ?? backoff, signal);
        backoff = Math.min(backoff * 2, 60_000);
      }
    }
  }
}
