// Limix: the fast lane for Google Antigravity. The managed runtime (agy_acp_server, a PyInstaller one-file build)
// unpacks 0.3-1.3 GB into a temp folder on every launch. Google's Antigravity CLI (`agy`, default install
// %LOCALAPPDATA%\agy\bin\agy.exe) starts at once and serves the same protocol with `agy acp`. Its Google sign-in
// lives in the OS keyring, so one computer has ONE such account: the first Antigravity AI that asks gets the CLI
// lane; every other one keeps the managed runtime with its own profile. LIMIX_AGY_CLI=0 turns the lane off.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

import { DATA_DIR } from "./config.ts";

const claimFile = (): string => join(DATA_DIR, "limix-agy-cli.json");

export function findAgyCli(env: Record<string, string | undefined> = process.env): string | null {
  if (env.LIMIX_AGY_CLI === "0") return null;
  const win = process.platform === "win32";
  const name = win ? "agy.exe" : "agy";
  const candidates: string[] = [];
  const localAppData = env.LOCALAPPDATA ?? process.env.LOCALAPPDATA;
  if (win && localAppData) candidates.push(join(localAppData, "agy", "bin", name));
  if (!win) candidates.push(join(homedir(), ".local", "bin", name));
  for (const dir of (env.PATH ?? env.Path ?? process.env.PATH ?? "").split(delimiter)) if (dir) candidates.push(join(dir, name));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function claimedBy(): string | null {
  try {
    const value = JSON.parse(readFileSync(claimFile(), "utf8")) as { instanceId?: unknown };
    return typeof value.instanceId === "string" ? value.instanceId : null;
  } catch {
    return null;
  }
}

/** The CLI path when `instanceId` owns the CLI lane (claiming it when free), else null. */
export function agyCliFor(instanceId: string, env: Record<string, string | undefined> = process.env): string | null {
  const cli = findAgyCli(env);
  if (!cli) return null;
  const owner = claimedBy();
  if (owner && owner !== instanceId) return null;
  if (!owner) {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(claimFile(), JSON.stringify({ instanceId, cli, at: new Date().toISOString() }));
    } catch {
      return null;
    }
  }
  return cli;
}

/** Signing out of the AI that owns the lane frees it for the next one. */
export function releaseAgyCli(instanceId: string): void {
  if (claimedBy() !== instanceId) return;
  try {
    writeFileSync(claimFile(), JSON.stringify({ instanceId: null }));
  } catch {
    // a stale claim only keeps this AI on the CLI lane
  }
}
