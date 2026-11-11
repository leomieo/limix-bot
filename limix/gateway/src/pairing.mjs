// DM pairing policy adapted from Hermes Agent `gateway/pairing.py`
// (NousResearch/hermes-agent @ b50d007e, MIT License, Copyright (c) 2025 Nous Research):
// 8-char codes from an unambiguous alphabet, 1 h expiry, at most 3 pending per connection,
// one request per user per 10 min, lockout after 5 failed approvals. Codes are stored hashed.
import { createHash, randomInt } from "node:crypto";
import { join } from "node:path";

import { readJson, writeJsonAtomic } from "./util/files.mjs";

export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
export const CODE_TTL_MS = 60 * 60_000;
export const RATE_LIMIT_MS = 10 * 60_000;
export const MAX_PENDING_PER_CONNECTION = 3;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 60 * 60_000;

const hash = (code) => createHash("sha256").update(code.toUpperCase().trim()).digest("hex");

export function newCode(length = CODE_LENGTH) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export class PairingStore {
  constructor(dataDir, now = () => Date.now()) {
    this.file = join(dataDir, "pairing.json");
    this.now = now;
    this.state = readJson(this.file, { pending: [], lastRequest: {}, failures: {} });
  }

  save() {
    writeJsonAtomic(this.file, this.state);
  }

  prune() {
    const t = this.now();
    this.state.pending = this.state.pending.filter((p) => p.expiresAt > t);
  }

  /** Returns { code } for a new request, or { refused: reason }. The plain code is only returned here. */
  request(connectionId, senderId, senderName) {
    this.prune();
    const t = this.now();
    const userKey = `${connectionId}:${senderId}`;
    const existing = this.state.pending.find((p) => p.connectionId === connectionId && p.senderId === senderId);
    if (existing) return { refused: "already_pending" };
    const last = this.state.lastRequest[userKey];
    if (last && t - last < RATE_LIMIT_MS) return { refused: "rate_limited" };
    if (this.state.pending.filter((p) => p.connectionId === connectionId).length >= MAX_PENDING_PER_CONNECTION) {
      return { refused: "too_many_pending" };
    }
    const code = newCode();
    this.state.pending.push({
      id: hash(`${connectionId}:${senderId}:${t}`).slice(0, 16),
      connectionId, senderId: String(senderId), senderName: String(senderName ?? "").slice(0, 80),
      codeHash: hash(code), createdAt: t, expiresAt: t + CODE_TTL_MS,
    });
    this.state.lastRequest[userKey] = t;
    this.save();
    return { code };
  }

  list(connectionId) {
    this.prune();
    return this.state.pending
      .filter((p) => !connectionId || p.connectionId === connectionId)
      .map(({ codeHash, ...rest }) => rest);
  }

  lockedOut(connectionId) {
    const f = this.state.failures[connectionId];
    return Boolean(f && f.count >= MAX_FAILED_ATTEMPTS && this.now() - f.at < LOCKOUT_MS);
  }

  /** Approve by code. Returns the approved request or { error }. */
  approve(connectionId, code) {
    this.prune();
    if (this.lockedOut(connectionId)) return { error: "locked_out" };
    const h = hash(String(code ?? ""));
    const idx = this.state.pending.findIndex((p) => p.connectionId === connectionId && p.codeHash === h);
    if (idx < 0) {
      const f = this.state.failures[connectionId] ?? { count: 0, at: 0 };
      this.state.failures[connectionId] = { count: this.now() - f.at < LOCKOUT_MS ? f.count + 1 : 1, at: this.now() };
      this.save();
      return { error: "invalid_code" };
    }
    const [req] = this.state.pending.splice(idx, 1);
    delete this.state.failures[connectionId];
    this.save();
    const { codeHash, ...rest } = req;
    return { approved: rest };
  }

  /** Approve from the Limix app, where the owner is already trusted and sees who asked. */
  approveById(id) {
    this.prune();
    const idx = this.state.pending.findIndex((p) => p.id === id);
    if (idx < 0) return { error: "not_found" };
    const [req] = this.state.pending.splice(idx, 1);
    this.save();
    const { codeHash, ...rest } = req;
    return { approved: rest };
  }

  deny(id) {
    const before = this.state.pending.length;
    this.state.pending = this.state.pending.filter((p) => p.id !== id);
    if (this.state.pending.length !== before) this.save();
    return before !== this.state.pending.length;
  }

  forgetConnection(connectionId) {
    this.state.pending = this.state.pending.filter((p) => p.connectionId !== connectionId);
    this.save();
  }
}

export const hashCode = hash;
