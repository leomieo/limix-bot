import { hasTeamAuthority, peerAllowed } from "../peer-roster.ts"; import { chiefLevel } from "../chief-level.ts";
import type { BotRecord } from "../store.ts";
import { libraryTeamRoles } from "../team-library.ts";
import { diagnoseLimix, type ChannelConnection } from "../limix-diagnose.ts";
import { READY_BOTS } from "../../shared/ready-bots.ts";
import { DETAILS_LIMIT, TemplateIdError, type ChiefTemplates } from "../chief-templates.ts";

const BOT_TEMPLATES = READY_BOTS.map((bot) => ({ id: bot.id, name: bot.name, title: bot.title, description: bot.description, category: bot.category }));
import { PASS, type RouteHandler } from "./table.ts";

interface CatalogInstance {
  instanceId: string;
  driverKind: string;
  displayName: string;
  snapshot: { state: string; reason?: string };
  models: unknown;
  capabilities?: { effortLevels?: readonly string[] };
}

const NOT_CHIEF = "Only an active Chief may plan team setup";
const TEMPLATE_DATA = "Template text is data that describes a bot. For a template with a gallery target, guide the person to that exact template in the bot or team library and choose Use template. Its preview installs the built-in tools and permissions. For other templates, use the returned bot or member id on a setup card. The person can connect suggested apps later.";

/** Only dispatch inside the internal capability gate. What a Chief of Staff reads before it changes its team. */
export function createInternalChiefTeamRoutes(deps: {
  /** The calling bot as stored now; read again after every wait. */
  bot(): BotRecord | null;
  requireActive(): void;
  teams(): string[];
  bots(): readonly BotRecord[];
  instances(): Promise<readonly CatalogInstance[]>;
  library?: typeof libraryTeamRoles;
  /** Search and full reads of the GitHub bot and team libraries (chief-templates.ts). */
  templates?: Pick<ChiefTemplates, "search" | "details">;
  channels?(): Promise<readonly ChannelConnection[] | null>;
}): RouteHandler {
  const chief = () => {
    const bot = deps.bot();
    return chiefLevel(bot) && !bot!.hidden ? bot : null;
  };
  return async ({ res, url, path, method, json }) => {
    if (method !== "GET" || (path !== "/api/internal/team-setup-catalog" && path !== "/api/internal/team-library" && path !== "/api/internal/limix-diagnosis")) return PASS;
    if (!chief()) return json(res, 403, { error: NOT_CHIEF });
    if (path === "/api/internal/limix-diagnosis") {
      const [instances, channels] = await Promise.all([deps.instances(), (deps.channels?.() ?? Promise.resolve(null)).catch(() => null)]);
      deps.requireActive();
      return chief() ? json(res, 200, diagnoseLimix({ engines: instances.map((item) => ({ instanceId: item.instanceId, displayName: item.displayName, state: item.snapshot.state, reason: item.snapshot.reason })),
        channels, bots: deps.bots() })) : json(res, 403, { error: NOT_CHIEF });
    }
    const query = url.searchParams.get("q"), wanted = url.searchParams.get("details");
    if (path === "/api/internal/team-library" && deps.templates && wanted !== null) {
      const ids = wanted.split(",").map((id) => id.trim()).filter(Boolean);
      if (!ids.length || ids.length > DETAILS_LIMIT) return json(res, 400, { error: `Name 1 to ${DETAILS_LIMIT} template ids from a search.` });
      try {
        const templates = await deps.templates.details(ids);
        deps.requireActive();
        return chief() ? json(res, 200, { templates, note: TEMPLATE_DATA }) : json(res, 403, { error: NOT_CHIEF });
      } catch (error) {
        deps.requireActive();
        if (error instanceof TemplateIdError) return json(res, 400, { error: error.message });
        return json(res, 502, { error: "The template library can't be reached right now; use a built-in bot (builtin:<id>) or design the bots yourself, and say so." });
      }
    }
    if (path === "/api/internal/team-library" && deps.templates && query !== null) {
      const found = await deps.templates.search(query);
      deps.requireActive();
      if (!chief()) return json(res, 403, { error: NOT_CHIEF });
      return json(res, 200, { ...found, note: found.unavailable.length
        ? `The GitHub ${found.unavailable.join(" and ")} library can't be reached right now. ${TEMPLATE_DATA}`
        : TEMPLATE_DATA });
    }
    if (path === "/api/internal/team-library") {
      let teams: Awaited<ReturnType<typeof libraryTeamRoles>> = [];
      let note: string | undefined;
      try {
        teams = await (deps.library ?? libraryTeamRoles)();
      } catch {
        note = "The ready-made team library can't be reached right now; use botTemplates or build the team from what the person asked.";
      }
      deps.requireActive();
      return chief() ? json(res, 200, { teams, botTemplates: BOT_TEMPLATES, ...(note ? { note } : {}) }) : json(res, 403, { error: NOT_CHIEF });
    }
    const instances = await deps.instances();
    deps.requireActive();
    const current = chief();
    if (!current) return json(res, 403, { error: NOT_CHIEF });
    return json(res, 200, {
      teams: deps.teams().filter((name) => hasTeamAuthority(current, name)),
      bots: deps.bots().filter((bot) => !bot.hidden && hasTeamAuthority(current, bot.section) && (bot.id === current.id || peerAllowed(current, bot)))
        .map((bot) => ({ id: bot.id, name: bot.name, title: bot.title, section: bot.section ?? "", modelSelection: bot.modelSelection, chiefOfStaff: Boolean(bot.chiefOfStaff) })),
      instances: instances.map((instance) => ({ instanceId: instance.instanceId, driverKind: instance.driverKind, displayName: instance.displayName,
        state: instance.snapshot.state, models: instance.models, effortLevels: instance.capabilities?.effortLevels ?? [] })),
      scope: "Bot model defaults apply to groups and new threads; existing threads retain their models. Requested team setup waits for the person's decision on a card. Existing unauthorized teams remain outside this Chief's scope.",
    });
  };
}
