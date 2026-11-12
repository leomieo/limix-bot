// Limix bot templates: the "Bot dựng sẵn" list in Templates comes from github.com/leomieo/limix-bot-teams.
// GET /api/limix/bots reads only the light list in catalog.json (cached ten minutes); GET /api/limix/bots/<id> fetches
// that one bot's file when the person presses "Dùng mẫu". Everything is checked here before it reaches the page, and a
// template only describes who the bot is: its routines always arrive paused and nothing is connected for the person.
import { MASCOT_BODY_IDS } from "../shared/mascot-bodies.ts";
import { MAUS_COLOR_NAMES } from "../shared/wire.ts";

const TEAM_LIBRARY_RAW_ROOT = "https://raw.githubusercontent.com/leomieo/limix-bot-teams/main";

const LIST_TTL_MS = 10 * 60 * 1000;
const MAX_CATALOG_BYTES = 256_000;
const MAX_BOT_BYTES = 64_000;
const CATEGORIES = ["everyday", "work", "writing", "design", "sales", "personal"] as const;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const NOTE_PATH = /^(?:MEMORY\.md|memory\/[a-z0-9][a-z0-9-]{0,63}\.md)$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export interface LibraryBotListing {
  id: string;
  name: string;
  title: string;
  category: (typeof CATEGORIES)[number];
  description: string;
  try: string;
  look: { color: string; mascotBody: string };
  apps: string[];
  routines: number;
}

export interface LibraryBot {
  id: string;
  category: (typeof CATEGORIES)[number];
  name: string;
  title: string;
  description: string;
  soul: string;
  look: { color: string; mascotBody: string };
  tryAsking: string[];
  apps: string[];
  notes?: Record<string, string>;
  routines?: Array<{ name: string; prompt: string; schedule: { type: "daily"; time: string; weekdays: number[] }; enabled: false; overlap: "skip" }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function text(value: unknown, field: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) throw new Error(`${field} is required`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${field} is too long`);
  return trimmed;
}

function look(value: unknown, field: string): { color: string; mascotBody: string } {
  if (!isRecord(value)) throw new Error(`${field} is invalid`);
  const color = text(value.color, `${field}.color`, 20);
  const mascotBody = text(value.mascotBody, `${field}.mascotBody`, 20);
  if (!(MAUS_COLOR_NAMES as readonly string[]).includes(color)) throw new Error(`${field}.color is not a known colour`);
  if (!(MASCOT_BODY_IDS as readonly string[]).includes(mascotBody)) throw new Error(`${field}.mascotBody is not a known shape`);
  return { color, mascotBody };
}

function category(value: unknown, field: string): (typeof CATEGORIES)[number] {
  const found = CATEGORIES.find((entry) => entry === value);
  if (!found) throw new Error(`${field} is not a known category`);
  return found;
}

function apps(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) throw new Error(`${field} is invalid`);
  return value.map((app, index) => {
    const slug = text(app, `${field}[${index}]`, 40);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) throw new Error(`${field}[${index}] is invalid`);
    return slug;
  });
}

export function parseBotListing(value: unknown): LibraryBotListing[] {
  if (!isRecord(value) || value.format !== "openmaus.catalog" || value.version !== 1) throw new Error("Danh sách mẫu không đúng định dạng");
  if (value.bots === undefined) return [];
  if (!Array.isArray(value.bots) || value.bots.length > 200) throw new Error("Danh sách bot mẫu không hợp lệ");
  const seen = new Set<string>();
  const out: LibraryBotListing[] = [];
  value.bots.forEach((raw, index) => {
    const field = `bots[${index}]`;
    try {
      if (!isRecord(raw)) throw new Error(`${field} is invalid`);
      const id = text(raw.id, `${field}.id`, 64);
      if (!ID.test(id) || seen.has(id)) throw new Error(`${field}.id is invalid`);
      const routines = typeof raw.routines === "number" && Number.isSafeInteger(raw.routines) && raw.routines >= 0 && raw.routines <= 10 ? raw.routines : 0;
      out.push({
        id, name: text(raw.name, `${field}.name`, 40), title: text(raw.title, `${field}.title`, 80),
        category: category(raw.category, `${field}.category`), description: text(raw.description, `${field}.description`, 300),
        try: text(raw.try, `${field}.try`, 200), look: look(raw.look, `${field}.look`), apps: apps(raw.apps, `${field}.apps`), routines,
      });
      seen.add(id);
    } catch {
      // One broken entry hides that entry only; the rest of the list still shows.
    }
  });
  return out;
}

export function parseLibraryBot(value: unknown, expectedId: string): LibraryBot {
  if (!isRecord(value) || value.format !== "limix.bot" || value.version !== 1) throw new Error("Tệp bot mẫu không đúng định dạng");
  const id = text(value.id, "id", 64);
  if (id !== expectedId) throw new Error("Tệp bot mẫu không khớp với danh sách");
  if (!Array.isArray(value.tryAsking) || value.tryAsking.length === 0 || value.tryAsking.length > 6) throw new Error("tryAsking is invalid");
  const bot: LibraryBot = {
    id, category: category(value.category, "category"), name: text(value.name, "name", 40), title: text(value.title, "title", 80),
    description: text(value.description, "description", 300), soul: text(value.soul, "soul", 8_000), look: look(value.look, "look"),
    tryAsking: value.tryAsking.map((line, index) => text(line, `tryAsking[${index}]`, 200)), apps: apps(value.apps, "apps"),
  };
  if (value.notes !== undefined) {
    if (!isRecord(value.notes) || Object.keys(value.notes).length > 6) throw new Error("notes is invalid");
    bot.notes = {};
    for (const [path, note] of Object.entries(value.notes)) {
      if (!NOTE_PATH.test(path)) throw new Error(`notes path ${path} is not allowed`);
      bot.notes[path] = text(note, `notes.${path}`, 8_000) + "\n";
    }
  }
  if (value.routines !== undefined) {
    if (!Array.isArray(value.routines) || value.routines.length > 5) throw new Error("routines is invalid");
    bot.routines = value.routines.map((raw, index) => {
      const field = `routines[${index}]`;
      if (!isRecord(raw) || !isRecord(raw.schedule) || raw.schedule.type !== "daily") throw new Error(`${field} is invalid`);
      const time = text(raw.schedule.time, `${field}.schedule.time`, 5);
      if (!TIME.test(time)) throw new Error(`${field}.schedule.time is invalid`);
      const weekdays = raw.schedule.weekdays;
      if (!Array.isArray(weekdays) || weekdays.length === 0 || weekdays.length > 7 || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
        throw new Error(`${field}.schedule.weekdays is invalid`);
      }
      // Paused, always: the person turns a routine on after reading it.
      return { name: text(raw.name, `${field}.name`, 80), prompt: text(raw.prompt, `${field}.prompt`, 2_000),
        schedule: { type: "daily" as const, time, weekdays: [...new Set(weekdays as number[])].sort() }, enabled: false as const, overlap: "skip" as const };
    });
  }
  return bot;
}

async function fetchJson(url: string, maxBytes: number): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json, text/plain;q=0.9" }, redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`GitHub trả lỗi HTTP ${response.status}`);
  const raw = await response.text();
  if (Buffer.byteLength(raw) > maxBytes) throw new Error("Tệp mẫu quá lớn");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GitHub không trả về JSON hợp lệ");
  }
}

let cached: { at: number; bots: LibraryBotListing[] } | null = null;

/** `fresh`: the "Cập nhật" button. Skips this cache and GitHub's (raw files are cached there for about five minutes). */
async function listing(fresh = false): Promise<LibraryBotListing[]> {
  if (!fresh && cached && Date.now() - cached.at < LIST_TTL_MS) return cached.bots;
  try {
    const bots = parseBotListing(await fetchJson(`${TEAM_LIBRARY_RAW_ROOT}/catalog.json${fresh ? `?t=${Date.now()}` : ""}`, MAX_CATALOG_BYTES));
    cached = { at: Date.now(), bots };
    return bots;
  } catch (error) {
    if (cached) return cached.bots; // an older list beats none while GitHub is unreachable
    throw error;
  }
}

/** GET /api/limix/bots, POST /api/limix/bots/refresh and GET /api/limix/bots/<id>. Null for any other path. */
export async function handleLimixBotLibrary(method: string, path: string): Promise<{ status: number; body: unknown } | null> {
  try {
    if (method === "POST" && path === "/api/limix/bots/refresh") return { status: 200, body: { bots: await listing(true) } };
    if (method !== "GET") return null;
    if (path === "/api/limix/bots") return { status: 200, body: { bots: await listing() } };
    const match = path.match(/^\/api\/limix\/bots\/([a-z0-9][a-z0-9-]{0,63})$/);
    if (!match) return null;
    const id = match[1]!;
    if (!(await listing()).some((bot) => bot.id === id)) return { status: 404, body: { error: "Không có bot mẫu này" } };
    return { status: 200, body: { bot: parseLibraryBot(await fetchJson(`${TEAM_LIBRARY_RAW_ROOT}/bots/${id}.json?t=${Date.now()}`, MAX_BOT_BYTES), id) } };
  } catch (error) {
    return { status: 502, body: { error: error instanceof Error ? error.message : String(error) } };
  }
}
