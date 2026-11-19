import { z } from "zod";
import { dockerWorkingFolderDesktopsStopped, perBotLocalVmTarget, type LocalVmTarget } from "../container-computer.ts";
import { ownerOrAdmin } from "../request-auth.ts";
import type { Store } from "../store.ts";
import { validatedVmWorkingFolder, type createVmWorkingFolders } from "../vm-working-folder.ts";
import { PASS, type RouteHandler } from "./table.ts";

export function createVmWorkingFolderRoutes(deps: {
  enabled: boolean;
  dataDir: string;
  store: Pick<Store, "bot" | "group">;
  grants: ReturnType<typeof createVmWorkingFolders>;
  perBot: () => boolean;
  busy: (target: LocalVmTarget) => boolean;
  locks: Set<string>;
  stopped?: (targets: readonly LocalVmTarget[]) => Promise<boolean>;
}): RouteHandler {
  const stopped = deps.stopped ?? dockerWorkingFolderDesktopsStopped;
  const updating = new Set<string>();
  const selection = (kind: string, id: string) => {
    if (kind === "bots") {
      const bot = deps.store.bot(id);
      return bot ? { folder: bot.cwd, bots: [id] } : undefined;
    }
    const group = deps.store.group(id);
    return group && !group.dm ? { folder: group.cwd, bots: [...new Set(group.memberIds)].sort() } : undefined;
  };
  return async ({ method, path, auth, req, res, json, readBody }) => {
    const match = /^\/api\/(bots|groups)\/([\w-]+)\/vm-working-folder$/u.exec(path);
    if (!match || (method !== "GET" && method !== "PUT")) return PASS;
    if (!deps.enabled || auth.kind !== "loopback" || auth.companionDevice || !ownerOrAdmin(auth)) {
      return json(res, 403, { error: "local desktop owner required" });
    }
    const kind = match[1]!;
    const id = match[2]!;
    const scope = `${kind}:${id}`;
    const canEnable = (selected: ReturnType<typeof selection>) => deps.perBot() &&
      Boolean(selected?.folder && selected.bots.length) && !selected?.bots.some((bot) => deps.store.bot(bot)?.desktopTeam);
    const payload = () => ({
      enabled: Boolean(deps.grants.scope(scope)),
      folder: deps.grants.scope(scope)?.folder ?? (kind === "bots" ? deps.grants.forBot(id)?.folder : undefined) ?? null,
      canEnable: canEnable(selection(kind, id)),
      currentBots: kind === "groups" ? selection(kind, id)?.bots.length ?? 0 : undefined,
      grantedBots: kind === "groups" ? deps.grants.scope(scope)?.bots.length ?? 0 : undefined,
      canRefresh: kind === "groups" && Boolean(deps.grants.scope(scope)) &&
        JSON.stringify(deps.grants.scope(scope)?.bots) !== JSON.stringify(selection(kind, id)?.bots),
      inherited: kind === "bots" && Boolean(deps.grants.forBot(id)) && !deps.grants.scope(scope),
    });
    if (method === "GET") return json(res, 200, payload());
    if (!String(req.headers["content-type"]).toLowerCase().startsWith("application/json")) return json(res, 415, { error: "content-type must be application/json" });
    const body = z.object({ enabled: z.boolean(), folder: z.string().optional() }).safeParse(await readBody(req));
    if (!body.success) return json(res, 400, { error: "invalid working folder grant" });
    const before = deps.grants.scope(scope);
    const selected = selection(kind, id);
    const inherited = kind === "bots" ? deps.grants.forBot(id) : undefined;
    if (body.data.enabled && (!canEnable(selected) || !selected?.folder || body.data.folder !== selected.folder)) {
      return json(res, 409, { code: "selection", error: "Choose a working folder and use private desktops." });
    }
    if (!body.data.enabled && !before && !inherited) return json(res, 200, payload());
    const revoke = !body.data.enabled && !before && inherited ? inherited : before;
    const bots = body.data.enabled ? selected!.bots : [];
    if (bots.some((bot) => {
      const existing = deps.grants.forBot(bot);
      return existing && existing.scope !== scope;
    })) return json(res, 409, { code: "overlap", error: "A selected bot already has another working folder grant." });
    let folder: string | undefined;
    if (body.data.enabled) {
      try { folder = validatedVmWorkingFolder(selected!.folder!, deps.dataDir); }
      catch { return json(res, 400, { code: "folder", error: "Choose a dedicated, existing working folder." }); }
    }
    if (revoke?.folder === folder && JSON.stringify(revoke?.bots) === JSON.stringify(bots)) return json(res, 200, payload());
    const revokingOne = !body.data.enabled && !before && inherited;
    const targets = [...new Set([...(revokingOne ? [id] : revoke?.bots ?? []), ...bots])].map(perBotLocalVmTarget);
    const update = revoke?.scope ?? scope;
    if (updating.has(update) || targets.some(deps.busy)) {
      return json(res, 409, { code: "stop", error: "Stop the affected desktops first, or wait for a previous change to finish." });
    }
    updating.add(update);
    for (const target of targets) deps.locks.add(target.key);
    try {
      if (!(await stopped(targets).catch(() => false))) return json(res, 409, { code: "stop", error: "Start Docker and stop the affected desktops first." });
      if (body.data.enabled && (!canEnable(selection(kind, id)) || JSON.stringify(selection(kind, id)) !== JSON.stringify(selected))) {
        return json(res, 409, { code: "selection", error: "The working folder or members changed. Retry." });
      }
      const remaining = revokingOne ? revokingOne.bots.filter((bot) => bot !== id) : [];
      deps.grants.save(update, folder ? { scope, folder, bots }
        : revokingOne && remaining.length ? { ...revokingOne, bots: remaining } : undefined);
      return json(res, 200, payload());
    } finally {
      updating.delete(update);
      for (const target of targets) deps.locks.delete(target.key);
    }
  };
}
