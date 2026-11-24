import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { canUseMcpServer, type ToolScope } from "../shared/tool-scope.ts";
import { DATA_DIR } from "./config.ts";
import type { McpServerSpec } from "./contracts.ts";

export const FACTORY = "limix-bot-factory";
export function factoryMount(bot: { id: string; defaultBot?: unknown; toolScope?: ToolScope }, privateHelperTurn: boolean): Record<string, McpServerSpec> {
  if (!privateHelperTurn || !bot.defaultBot || !/^[\w-]{1,128}$/.test(bot.id) || !canUseMcpServer(bot.toolScope, FACTORY)) return {};
  const script = resolve(process.env.OMB_SKILLS_DIR || "skills", FACTORY, "scripts", "mcp_server.py");
  if (!existsSync(script)) return {};
  return { [FACTORY]: {
    command: process.env.LIMIX_PYTHON || (process.platform === "win32" ? "python" : "python3"),
    args: ["-B", "-S", "-X", "utf8", script],
    env: { LIMIX_FACTORY_WORKSPACE: join(DATA_DIR, "factory-drafts", bot.id), PYTHONNOUSERSITE: "1" },
  } };
}
