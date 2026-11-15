// What the assistant reads to find out why a bot or a chat connection is not working. Read-only: it says what is wrong
// and what the person can approve or do; any change still goes through a card.
export interface ChannelConnection { id: string; platform: string; name?: string; status: string; statusDetail?: string; running?: boolean; enabled?: boolean }
export interface DiagnoseInput {
  engines: readonly { instanceId: string; displayName: string; state: string; reason?: string }[];
  /** Null: the Telegram / Zalo connector can't be read from this server. */
  channels: readonly ChannelConnection[] | null;
  bots: readonly { id: string; name: string; hidden?: boolean }[];
}
export interface Finding { area: "channel" | "engine" | "setup"; subject: string; problem: string; fix: string }

const CHANNEL_FIX: Record<string, string> = {
  credential_invalid: "The token was refused. Make a fresh token in the platform's bot settings and paste it in the connection (the person does this; never ask them to send it in chat).",
  conflict: "Another program is reading the same bot's messages. Stop that program or remove its webhook, then press Run again on the connection.",
  degraded: "The connection is retrying after errors. If it persists, check the internet connection and the platform's status.",
  error: "The connection stopped on an error. Press Run again; if it fails again, re-create the connection with a new token.",
  stopped: "The connection is switched off. Press Run on it to start answering again.",
};
const CHANNEL_NAME: Record<string, string> = { telegram: "Telegram", zalo: "Zalo", discord: "Discord", facebook: "Facebook Page" };

export function diagnoseLimix(input: DiagnoseInput): { ok: boolean; summary: string; findings: Finding[]; channels: unknown[]; engines: unknown[]; botCount: number; notes: string[] } {
  const findings: Finding[] = [];
  const notes: string[] = [];
  for (const channel of input.channels ?? []) {
    const label = `${CHANNEL_NAME[channel.platform] ?? channel.platform}${channel.name ? ` · ${channel.name}` : ""}`;
    if (channel.status === "running" && !channel.statusDetail) continue;
    if (channel.status === "running") { findings.push({ area: "channel", subject: label, problem: `Connected, with a warning: ${channel.statusDetail}`, fix: "The channel works; the warning is about the AI it uses. Check that bot's engine sign-in." }); continue; }
    if (channel.status === "starting") continue;
    findings.push({ area: "channel", subject: label, problem: `Not answering (${channel.status})${channel.statusDetail ? `: ${channel.statusDetail}` : ""}`,
      fix: CHANNEL_FIX[channel.status] ?? "Open the connection and press Run again." });
  }
  if (input.channels === null) notes.push("Telegram and Zalo connections can't be read from here (they run in the desktop app or in another service). Ask the person to open Connections and say what status each one shows.");
  else if (!input.channels.length) notes.push("No Telegram, Zalo, Discord or Facebook connection is set up yet.");
  for (const engine of input.engines) {
    if (engine.state === "available") continue;
    findings.push({ area: "engine", subject: engine.displayName, problem: `The AI engine is ${engine.state}${engine.reason ? `: ${engine.reason}` : ""}`, fix: "Open Settings > AI, sign in again or install the engine; bots that use it can't answer until then." });
  }
  const visible = input.bots.filter((bot) => !bot.hidden);
  if (!visible.length) findings.push({ area: "setup", subject: "Bots", problem: "There is no active bot", fix: "Propose a bot or a ready-made team with propose_team_setup." });
  return { ok: findings.length === 0, botCount: visible.length, findings, notes,
    channels: (input.channels ?? []).map((c) => ({ platform: c.platform, name: c.name, status: c.status, running: c.running, enabled: c.enabled })),
    engines: input.engines.map((e) => ({ name: e.displayName, state: e.state })),
    summary: findings.length ? `${findings.length} problem${findings.length === 1 ? "" : "s"} found` : "Nothing wrong found in what this assistant can see" };
}
