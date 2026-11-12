// Limix Skill Hub client: keeps a cached copy of the hub catalog, installs a skill only after every file matches the
// SHA-256 the catalog pins, and never installs scripts, binaries or MCP files unless the owner allows tools for that
// one skill. Installed skills wait in the store ("Kho Kĩ Năng (Skills)"), switched on but on no bot until one is added to it. Auto Sync (catalog refresh) is on by default,
// Auto Install is off by default.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isSkillName } from "../shared/skill-md.ts";
import { writeFileAtomic } from "./atomic.ts";
import { DATA_DIR } from "./config.ts";
import { installLibrarySkill, readSkillLibraryIndex, retireLibrarySkill, setLibrarySkillReviewState } from "./skill-library.ts";

export const HUB_REPO = "leomieo/limix-skill-hub";
const HUB_BRANCH = "main";
const SYNC_MIN_GAP_MS = 20 * 60 * 60 * 1000;
const FILE_MAX_BYTES = 1024 * 1024;

export interface HubEntry {
  id: string;
  name: string;
  description: string;
  description_vi?: string | null;
  version: string;
  source: { repository: string | null; commit: string | null; path: string | null };
  license: string | null;
  language: string;
  category: string;
  tags: string[];
  quality_score: number;
  grade: string;
  security_status: string;
  approval_status: string;
  kind: string;
  compatibility: { text: string | null; runtimes: Array<{ name: string; installerId: string | null }> };
  dependencies: string[];
  permissions: { runs_code: boolean; mcp: boolean; files: string[] };
  checksum: string;
  file_hashes: Record<string, string>;
  notes: string[];
  last_checked: string | null;
  area: string;
}

export interface HubSettings {
  autoSync: boolean;
  autoInstall: boolean;
  lastSync: string | null;
  lastError: string | null;
  etag: string | null;
}

const DEFAULT_SETTINGS: HubSettings = { autoSync: true, autoInstall: false, lastSync: null, lastError: null, etag: null };

const hubDir = (): string => join(DATA_DIR, "skill-hub");
const settingsFile = (): string => join(hubDir(), "settings.json");
const catalogFile = (): string => join(hubDir(), "catalog.json");

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function hubSettings(): HubSettings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<HubSettings>>(settingsFile(), {}) };
}

function saveSettings(next: HubSettings): void {
  mkdirSync(hubDir(), { recursive: true, mode: 0o700 });
  writeFileAtomic(settingsFile(), JSON.stringify(next, null, 2), { mode: 0o600 });
}

export function hubCatalog(): HubEntry[] {
  const body = readJson<{ skills?: HubEntry[] }>(catalogFile(), {});
  return Array.isArray(body.skills) ? body.skills : [];
}

const rawUrl = (path: string): string => `https://raw.githubusercontent.com/${HUB_REPO}/${HUB_BRANCH}/${path}`;

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "limix-bot", ...headers } });
}

let syncing: Promise<{ changed: boolean; count: number } | { error: string }> | null = null;

/** Refreshes the cached catalog (ETag, so an unchanged hub costs one tiny request). */
export function syncHub(): Promise<{ changed: boolean; count: number } | { error: string }> {
  if (syncing) return syncing;
  syncing = (async () => {
    const settings = hubSettings();
    try {
      const response = await fetchText(rawUrl("registry/catalog.json"), settings.etag && existsSync(catalogFile()) ? { "If-None-Match": settings.etag } : {});
      if (response.status === 304) {
        saveSettings({ ...settings, lastSync: new Date().toISOString(), lastError: null });
        return { changed: false, count: hubCatalog().length };
      }
      if (!response.ok) throw new Error(`Hub trả về ${response.status}`);
      const text = await response.text();
      const parsed = JSON.parse(text) as { skills?: unknown };
      if (!Array.isArray(parsed.skills)) throw new Error("Danh mục Hub không đúng định dạng");
      mkdirSync(hubDir(), { recursive: true, mode: 0o700 });
      writeFileAtomic(catalogFile(), text, { mode: 0o600 });
      saveSettings({ ...settings, etag: response.headers.get("etag"), lastSync: new Date().toISOString(), lastError: null });
      if (settings.autoInstall) await autoInstallEligible();
      return { changed: true, count: parsed.skills.length };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      saveSettings({ ...settings, lastError: message });
      return { error: message };
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

const SCRIPT = /\.(py|js|mjs|cjs|ts|sh|bash|zsh|ps1|bat|cmd|rb|pl|php|go|rs|exe|dll|so|dylib|bin|jar|class|scr|msi|com|apk|dex|node|wasm)$/i;
const MCP_FILE = /(^|\/)(\.mcp\.json|mcp\.json|mcp-servers?\.json|claude_desktop_config\.json)$/i;
const isToolFile = (path: string): boolean => SCRIPT.test(path) || MCP_FILE.test(path);
const sha = (data: Uint8Array | string): string => createHash("sha256").update(data).digest("hex");

export function hubSkillBlocked(entry: HubEntry): string | null {
  if (entry.area === "quarantine" || entry.security_status === "quarantined") return "Skill nằm trong khu cách ly vì có mã nguy hiểm.";
  if (entry.approval_status === "quarantined" || entry.approval_status === "rejected") return "Skill bị từ chối.";
  return null;
}

/** installed state of every catalog entry that came from the hub */
function installedFromHub(): Map<string, { checksum: string; sha256: string; reviewState: string }> {
  const out = new Map<string, { checksum: string; sha256: string; reviewState: string }>();
  for (const entry of Object.values(readSkillLibraryIndex())) {
    const match = /^limix-hub:([a-z0-9-]+)@([0-9a-f]{64})/.exec(entry.source);
    if (match) out.set(match[1]!, { checksum: match[2]!, sha256: entry.sha256, reviewState: entry.reviewState });
  }
  return out;
}

export interface HubSkillWire extends HubEntry {
  installed: boolean;
  enabled: boolean;
  updateAvailable: boolean;
  blocked: string | null;
  risky: string | null;
}

export function hubSkills(): HubSkillWire[] {
  const installed = installedFromHub();
  const library = readSkillLibraryIndex();
  return hubCatalog().map((entry) => {
    const have = installed.get(entry.id);
    return {
      ...entry,
      installed: Boolean(have),
      // A same-named skill the owner imported by hand is not the hub's: never touched by sync.
      enabled: have?.reviewState === "approved",
      updateAvailable: Boolean(have && have.checksum !== entry.checksum),
      blocked: !have && library[entry.id] ? "Thư viện đã có kỹ năng cùng tên không đến từ Hub." : null,
      risky: hubSkillBlocked(entry),
    };
  });
}

export async function installHubSkill(id: string, options: { allowTools?: boolean; allowRisky?: boolean } = {}): Promise<{ ok: true; skipped: string[] } | { error: string }> {
  if (!isSkillName(id)) return { error: "Tên kỹ năng không hợp lệ" };
  const entry = hubCatalog().find((e) => e.id === id);
  if (!entry) return { error: "Không thấy kỹ năng này trong danh mục Hub. Hãy đồng bộ lại." };
  const blocked = hubSkillBlocked(entry);
  if (blocked && !options.allowRisky) return { error: blocked };
  const installed = installedFromHub().get(id);
  const existing = readSkillLibraryIndex()[id];
  if (existing && !installed) return { error: "Thư viện đã có kỹ năng cùng tên không đến từ Hub." };
  const wanted = Object.keys(entry.file_hashes).filter((path) => path !== "SKILL.md" && (options.allowTools || !isToolFile(path)));
  const skipped = Object.keys(entry.file_hashes).filter((path) => path !== "SKILL.md" && !wanted.includes(path));
  const files: Array<{ path: string; content: Uint8Array }> = [];
  let skillMd = "";
  for (const path of ["SKILL.md", ...wanted]) {
    const expected = entry.file_hashes[path];
    if (!expected) return { error: `Danh mục thiếu mã kiểm tra cho ${path}` };
    let response: Response;
    try {
      response = await fetchText(rawUrl(`${entry.area === "quarantine" ? "quarantine" : "skills"}/${id}/${path}`));
    } catch (cause) {
      return { error: `Không tải được ${path}: ${cause instanceof Error ? cause.message : String(cause)}` };
    }
    if (!response.ok) return { error: `Không tải được ${path} (${response.status})` };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > FILE_MAX_BYTES) return { error: `${path} quá lớn` };
    // Pinned content: a file the hub no longer serves as catalogued is refused, never installed.
    if (sha(bytes) !== expected) return { error: `${path} không khớp mã SHA-256 trong danh mục — đã dừng cài` };
    if (path === "SKILL.md") skillMd = new TextDecoder().decode(bytes);
    else files.push({ path, content: bytes });
  }
  if (installed) {
    const retired = retireLibrarySkill(id, installed.sha256);
    if ("error" in retired) return { error: retired.error };
    if ("stale" in retired) return { error: "Kỹ năng đã bị sửa tay sau khi cài, không cập nhật đè." };
  }
  const result = installLibrarySkill({
    name: id,
    instructions: skillMd,
    source: `limix-hub:${id}@${entry.checksum} (${entry.source.repository ?? "?"}@${(entry.source.commit ?? "").slice(0, 7)})`,
    ...(entry.license ? { license: entry.license } : {}),
    ...(entry.compatibility.text ? { compatibility: entry.compatibility.text } : {}),
    ...(entry.tags.length ? { tags: entry.tags } : {}),
    warnings: entry.notes,
    skippedFiles: skipped,
    reviewState: "approved",
    ...(files.length ? { files } : {}),
  });
  if ("error" in result) return { error: result.error };
  return { ok: true, skipped };
}

export function setHubSkillEnabled(id: string, enabled: boolean): { ok: true } | { error: string } {
  if (!installedFromHub().has(id)) return { error: "Kỹ năng này chưa cài từ Hub" };
  const result = setLibrarySkillReviewState(id, enabled ? "approved" : "disabled");
  return "error" in result ? { error: result.error } : { ok: true };
}

export function removeHubSkill(id: string): { ok: true } | { error: string } {
  const installed = installedFromHub().get(id);
  if (!installed) return { error: "Kỹ năng này chưa cài từ Hub" };
  const result = retireLibrarySkill(id, installed.sha256);
  if ("error" in result) return { error: result.error };
  if ("stale" in result) return { error: "Kỹ năng đã bị sửa tay sau khi cài, không gỡ tự động." };
  return { ok: true }; // the bytes stay in the library archive, so a removal can be undone by hand
}

/** Auto Install (off by default): only excellent/recommended, approved, instructions-only skills; max 5 per sync. */
async function autoInstallEligible(): Promise<void> {
  let budget = 5;
  for (const skill of hubSkills()) {
    if (budget <= 0) return;
    const eligible = !skill.blocked && !skill.risky && skill.kind === "instructions-only" && skill.approval_status === "approved" && (skill.grade === "excellent" || skill.grade === "recommended");
    if (!eligible || (skill.installed && !skill.updateAvailable)) continue;
    budget -= 1;
    const done = await installHubSkill(skill.id);
    if ("ok" in done && skill.updateAvailable && skill.enabled) setHubSkillEnabled(skill.id, true);
  }
}

export interface HubRouteResult { status: number; body: unknown }

export async function handleLimixHub(method: string, path: string, body: unknown): Promise<HubRouteResult | null> {
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (method === "GET" && path === "/api/limix/hub") {
    return { status: 200, body: { repo: HUB_REPO, settings: hubSettings(), skills: hubSkills() } };
  }
  if (method === "POST" && path === "/api/limix/hub/sync") {
    const result = await syncHub();
    return "error" in result ? { status: 502, body: result } : { status: 200, body: result };
  }
  if (method === "POST" && path === "/api/limix/hub/settings") {
    const current = hubSettings();
    saveSettings({
      ...current,
      autoSync: typeof record.autoSync === "boolean" ? record.autoSync : current.autoSync,
      autoInstall: typeof record.autoInstall === "boolean" ? record.autoInstall : current.autoInstall,
    });
    return { status: 200, body: { settings: hubSettings() } };
  }
  const id = typeof record.id === "string" ? record.id : "";
  if (method === "POST" && (path === "/api/limix/hub/install" || path === "/api/limix/hub/update")) {
    const result = await installHubSkill(id, { allowTools: record.allowTools === true, allowRisky: record.allowRisky === true });
    return "error" in result ? { status: 422, body: result } : { status: 200, body: result };
  }
  if (method === "POST" && path === "/api/limix/hub/enable") {
    const result = setHubSkillEnabled(id, record.enabled === true);
    return "error" in result ? { status: 422, body: result } : { status: 200, body: result };
  }
  if (method === "POST" && path === "/api/limix/hub/remove") {
    const result = removeHubSkill(id);
    return "error" in result ? { status: 422, body: result } : { status: 200, body: result };
  }
  return null;
}

let started = false;
/** Auto Sync: once soon after start, then checked every 30 minutes; it only runs when 20 h have passed. */
export function startHubAutoSync(): void {
  if (started) return;
  started = true;
  const tick = (): void => {
    const settings = hubSettings();
    if (!settings.autoSync) return;
    if (settings.lastSync && Date.now() - Date.parse(settings.lastSync) < SYNC_MIN_GAP_MS) return;
    void syncHub();
  };
  setTimeout(tick, 60_000).unref();
  setInterval(tick, 30 * 60 * 1000).unref();
}
