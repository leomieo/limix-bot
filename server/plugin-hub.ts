import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { writeFileAtomic } from "./atomic.ts";
import { ownerOrAdmin } from "./request-auth.ts";
import { PASS, type RouteHandler } from "./routes/table.ts";
import { pluginEnabled, type PluginLibrary } from "../shared/plugin-hub.ts";

const root = "https://raw.githubusercontent.com/leomieo/limix-plugin-hub/main/";
const slug = z.string().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const labels = (max: number) => z.object({ en: z.string().min(1).max(max), vi: z.string().min(1).max(max) }).strict();
const metadata = z.object({
  id: slug, version: z.string().max(40).regex(/^\d+\.\d+\.\d+$/),
  name: labels(96), description: labels(600),
  requiresMcp: z.array(z.string().regex(/^[\w-]{1,80}$/)).max(12),
}).strict();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const entry = metadata.extend({ sha256: digest });
const catalog = z.array(entry).max(500).refine(rows => new Set(rows.map(r => r.id)).size === rows.length);
const bundle = metadata.extend({ instructions: z.string().trim().min(1).max(8000) });
const installed = bundle.extend({ sha256: digest, teams: z.array(z.string()), bots: z.record(z.string(), z.boolean()) });
const database = z.object({ catalog, installed: z.array(installed) });
const change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("install"), id: slug, sha256: digest }),
  z.object({ action: z.literal("remove"), id: slug }),
  z.object({ action: z.literal("assign"), id: slug, sha256: digest, target: z.enum(["bot", "team"]), key: z.string().min(1).max(256), enabled: z.boolean().nullable() }),
]);

async function download(path: string, limit: number) {
  const response = await fetch(root + path, { redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body) throw Error("Plugin download failed (" + response.status + ")");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw Error("Plugin download exceeds size limit"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function createPluginHub(dir: string, targets: () => { bots: { id: string; name: string; section?: string }[]; teams: string[] }, load = download) {
  const file = join(dir, "plugin-library.json");
  let state: PluginLibrary = { catalog: [], installed: [] };
  let readable = true;
  if (existsSync(file)) {
    try { state = database.parse(JSON.parse(readFileSync(file, "utf8"))); }
    catch { readable = false; }
  }
  const save = (next: PluginLibrary) => { writeFileAtomic(file, JSON.stringify(next), { mode: 0o600 }); state = next; };
  const view = () => ({ ...state, ...targets() });
  const route: RouteHandler = async ({ req, res, path, method, auth, json, readBody }) => {
    if (path !== "/api/limix/plugins") return PASS;
    if (!ownerOrAdmin(auth) || (auth.kind === "loopback" && auth.companionDevice)) return json(res, 403, { error: "forbidden: this session lacks the admin scope" });
    if (!readable) return json(res, 503, { error: "The saved plugin library could not be read" });
    if (method === "GET") return json(res, 200, view());
    if (method !== "POST") return json(res, 405, { error: "Method not allowed" });
    const parsed = change.safeParse(await readBody(req));
    if (!parsed.success) return json(res, 400, { error: "Invalid plugin action" });
    const input = parsed.data;
    if (input.action === "sync") {
      try {
        const rows = catalog.parse(JSON.parse((await load("catalog.json", 1024 * 1024)).toString()));
        save({ ...state, catalog: rows });
      } catch { return json(res, 502, { error: "Could not sync the plugin catalog" }); }
    } else if (input.action === "install") {
      const row = state.catalog.find(r => r.id === input.id && r.sha256 === input.sha256);
      if (!row) return json(res, 409, { error: "Refresh the catalog and review this version" });
      try {
        const bytes = await load("plugins/" + row.id + ".json", 65536);
        if (createHash("sha256").update(bytes).digest("hex") !== row.sha256) throw Error("digest");
        const pack = bundle.parse(JSON.parse(bytes.toString()));
        if (JSON.stringify(packMetadata(pack)) !== JSON.stringify(packMetadata(row))) throw Error("metadata");
        if (!state.catalog.some(r => r.id === row.id && r.sha256 === row.sha256)) throw Error("stale");
        if (!state.installed.some(p => p.id === row.id && p.sha256 === row.sha256)) {
          save({ ...state, installed: [...state.installed.filter(p => p.id !== row.id), { ...pack, sha256: row.sha256, teams: [], bots: {} }] });
        }
      } catch { return json(res, 422, { error: "Plugin download or integrity check failed" }); }
    } else if (input.action === "remove") {
      save({ ...state, installed: state.installed.filter(p => p.id !== input.id) });
    } else {
      const current = state.installed.find(p => p.id === input.id && p.sha256 === input.sha256);
      if (!current) return json(res, 409, { error: "Review the installed version first" });
      const { bots, teams } = targets();
      const next = structuredClone(current);
      if (input.target === "bot") {
        if (!bots.some(b => b.id === input.key)) return json(res, 404, { error: "Unknown bot" });
        if (input.enabled === null) delete next.bots[input.key];
        else next.bots[input.key] = input.enabled;
      } else {
        if (!teams.includes(input.key)) return json(res, 404, { error: "Unknown team" });
        next.teams = next.teams.filter(s => s !== input.key);
        if (input.enabled) next.teams.push(input.key);
      }
      save({ ...state, installed: state.installed.map(p => p.id === next.id ? next : p) });
    }
    return json(res, 200, view());
  };
  return { route, pruneTeams(teams: string[]) {
    if (!state.installed.some(p => p.teams.some(team => !teams.includes(team)))) return;
    save({ ...state, installed: state.installed.map(p => ({ ...p, teams: p.teams.filter(team => teams.includes(team)) })) });
  }, renameTeam(from: string, to: string | null) {
    if (!state.installed.some(p => p.teams.includes(from))) return;
    save({ ...state, installed: state.installed.map(p => ({ ...p, teams: p.teams.flatMap(team => team !== from ? [team] : to ? [to] : []) })) });
  }, instructions(bot: { id: string; section?: string }, availableMcp: string[]) {
    return state.installed.filter(p => pluginEnabled(p, bot) && p.requiresMcp.every(name => availableMcp.includes(name)))
      .map(p => "\n\nPlugin " + p.id + " (" + p.version + ")\n" + p.instructions).join("");
  } };
}

function packMetadata({ id, version, name, description, requiresMcp }: z.infer<typeof metadata>) {
  return { id, version, name, description, requiresMcp };
}
