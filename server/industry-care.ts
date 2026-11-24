import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { INDUSTRY_CARE_SERVER, INDUSTRY_CARE_SKILL } from "../shared/industry-templates.ts";
import { allowsTool, canUseMcpServer, type ToolScope } from "../shared/tool-scope.ts";
import { DATA_DIR } from "./config.ts";
import type { McpServerSpec } from "./contracts.ts";
import { bundledPicks, limixBundledSwitch } from "./limix-skill-store.ts";

type CareBot = { id: string; toolScope?: ToolScope };
type Servers = Record<string, McpServerSpec>;
type McpPolicy = (servers: Servers) => Servers;
const toolNames = ["care_triage", "care_lookup", "care_prepare_case"];

function careLocation(botId: string) {
  if (!/^[\w-]{1,128}$/.test(botId)) throw new Error("Invalid bot ID");
  return {
    catalogDir: join(DATA_DIR, INDUSTRY_CARE_SKILL, botId),
    entry: resolve(process.env.OMB_SKILLS_DIR || "skills", INDUSTRY_CARE_SKILL, "scripts", "care.mjs"),
  };
}

export function enableIndustryCare(botId: string): void {
  if (!existsSync(careLocation(botId).entry) || limixBundledSwitch(botId, INDUSTRY_CARE_SKILL, true)?.status !== 200) {
    throw new Error("Thiếu bộ công cụ CSKH trong bản cài Limix Bot.");
  }
}

export function isIndustryCareBot(bot: CareBot): boolean {
  return Boolean(bot.toolScope?.allow?.some(selector => selector.startsWith(`mcp:${INDUSTRY_CARE_SERVER}:`))) || bundledPicks(bot.id).has(INDUSTRY_CARE_SKILL);
}

function careServers(bot: CareBot, policy: McpPolicy): Servers {
  if (!canUseMcpServer(bot.toolScope, INDUSTRY_CARE_SERVER, toolNames) || !bundledPicks(bot.id).has(INDUSTRY_CARE_SKILL)) return {};
  const { entry, catalogDir } = careLocation(bot.id);
  if (!existsSync(entry)) return {};
  return policy({ [INDUSTRY_CARE_SERVER]: {
    command: process.execPath, args: [entry, "mcp", "--scope", bot.id, "--catalog-dir", catalogDir],
    env: { ELECTRON_RUN_AS_NODE: "1" },
  } });
}

export function withIndustryCareMcp(bot: CareBot, custom: Servers, policy: McpPolicy, boxed: boolean): Servers {
  if (!isIndustryCareBot(bot)) return custom;
  const mounts = { ...custom };
  // The tool scope names this bundled server. An external server must never impersonate it.
  delete mounts[INDUSTRY_CARE_SERVER];
  return boxed ? mounts : { ...mounts, ...careServers(bot, policy) };
}

interface CareToolkit {
  triageTicket(input: { text: string }): unknown;
  lookupPublicCatalog(input: { sku: string }, options: { scope: string; catalogDir: string }): Promise<unknown>;
}

export async function industryGuestFacts(bot: CareBot, message: string, policy: McpPolicy): Promise<string | undefined> {
  if (!isIndustryCareBot(bot)) return undefined;
  if (!careServers(bot, policy)[INDUSTRY_CARE_SERVER]) return JSON.stringify({ status: "unavailable" });
  const { entry, catalogDir } = careLocation(bot.id);
  const allowed = (name: string) => allowsTool(bot.toolScope, { kind: "mcp", server: INDUSTRY_CARE_SERVER, name });
  try {
    const toolkit: CareToolkit = await import(pathToFileURL(entry).href);
    const token = /\bsku(?:\s*[:#=]\s*|\s+)(\S+)/i.exec(message)?.[1]?.replace(/[?,!;)]+$/u, "");
    const sku = token && /^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/.test(token) ? token : undefined;
    const triage = allowed("care_triage") ? toolkit.triageTicket({ text: message.trim().slice(0, 2000) }) : undefined;
    const catalog = allowed("care_lookup") && sku ? await toolkit.lookupPublicCatalog({ sku }, { scope: bot.id, catalogDir }) : undefined;
    return JSON.stringify({ triage, catalog });
  } catch {
    return JSON.stringify({ status: "unavailable" });
  }
}
