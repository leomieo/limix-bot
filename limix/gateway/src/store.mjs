import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { readJson, writeJsonAtomic } from "./util/files.mjs";
import { redact } from "./util/redact.mjs";

const MAX_SEEN = 1000;
const MAX_ACTIVITY = 300;
const MAX_INBOX = 500;

const empty = () => ({
  version: 1,
  connections: [],
  sessions: {},
  cursors: {},
  seen: {},
  linkCodes: {},
  inbox: [],
  activity: [],
});

export class Store {
  constructor(dataDir, now = () => Date.now()) {
    this.file = join(dataDir, "state.json");
    this.now = now;
    this.state = { ...empty(), ...readJson(this.file, empty()) };
  }

  save() {
    writeJsonAtomic(this.file, this.state);
  }

  // Connections
  listConnections() {
    return this.state.connections;
  }

  getConnection(id) {
    return this.state.connections.find((c) => c.id === id);
  }

  addConnection(fields) {
    const conn = {
      id: `conn_${randomUUID().slice(0, 8)}`,
      createdAt: this.now(),
      enabled: true,
      status: "stopped",
      statusDetail: "",
      ownerIds: [],
      allowedIds: [],
      accessPolicy: "pairing",
      ...fields,
    };
    this.state.connections.push(conn);
    this.save();
    return conn;
  }

  updateConnection(id, patch) {
    const conn = this.getConnection(id);
    if (!conn) return undefined;
    Object.assign(conn, patch);
    this.save();
    return conn;
  }

  removeConnection(id) {
    this.state.connections = this.state.connections.filter((c) => c.id !== id);
    for (const key of Object.keys(this.state.sessions)) if (key.startsWith(`${id}|`)) delete this.state.sessions[key];
    delete this.state.cursors[id];
    delete this.state.seen[id];
    delete this.state.linkCodes[id];
    this.state.inbox = this.state.inbox.filter((e) => e.connectionId !== id);
    this.save();
  }

  // Sessions: one engine thread per (connection, chat, sender).
  static sessionKey(connectionId, chatId, senderId) {
    return `${connectionId}|${chatId}|${senderId}`;
  }

  getThread(key) {
    return this.state.sessions[key]?.threadId;
  }

  setThread(key, threadId) {
    this.state.sessions[key] = { threadId, updatedAt: this.now() };
    this.save();
  }

  resetSession(key) {
    delete this.state.sessions[key];
    this.save();
  }

  // Polling cursor and duplicate guard, persisted so a restart neither loses nor repeats an update.
  getCursor(connectionId) {
    return this.state.cursors[connectionId];
  }

  setCursor(connectionId, cursor) {
    this.state.cursors[connectionId] = cursor;
    this.save();
  }

  /** Records the event once. Returns false when it was already seen. */
  acceptEvent(event) {
    const seen = (this.state.seen[event.connectionId] ??= []);
    if (seen.includes(event.eventId)) return false;
    seen.push(event.eventId);
    if (seen.length > MAX_SEEN) seen.splice(0, seen.length - MAX_SEEN);
    this.state.inbox.push({
      connectionId: event.connectionId, eventId: event.eventId, chatId: event.chatId,
      senderId: event.senderId, state: "received", at: this.now(),
    });
    if (this.state.inbox.length > MAX_INBOX) this.state.inbox.splice(0, this.state.inbox.length - MAX_INBOX);
    this.save();
    return true;
  }

  markEvent(connectionId, eventId, state) {
    const row = this.state.inbox.find((e) => e.connectionId === connectionId && e.eventId === eventId);
    if (!row) return;
    row.state = state;
    row.updatedAt = this.now();
    this.save();
  }

  /** Events that were mid-processing when the gateway stopped. They are not re-run (the engine may have acted). */
  takeInterrupted() {
    const rows = this.state.inbox.filter((e) => e.state === "received" || e.state === "processing");
    for (const r of rows) r.state = "interrupted";
    if (rows.length) this.save();
    return rows;
  }

  // One-time owner link codes (hashed).
  setLinkCode(connectionId, codeHash, expiresAt) {
    this.state.linkCodes[connectionId] = { codeHash, expiresAt };
    this.save();
  }

  takeLinkCode(connectionId, codeHash) {
    const lc = this.state.linkCodes[connectionId];
    if (!lc || lc.expiresAt < this.now() || lc.codeHash !== codeHash) return false;
    delete this.state.linkCodes[connectionId];
    this.save();
    return true;
  }

  // Activity log shown in the app. Text is redacted before it is kept.
  log(connectionId, kind, text) {
    this.state.activity.push({ at: this.now(), connectionId, kind, text: redact(text).slice(0, 300) });
    if (this.state.activity.length > MAX_ACTIVITY) this.state.activity.splice(0, this.state.activity.length - MAX_ACTIVITY);
    this.save();
  }
}
