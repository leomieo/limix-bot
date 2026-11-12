// Limix Bot: Instabox (https://instabox.sh) as the cloud computer service, behind the same transport as Boat.
// An Instabox API key (ibk_…) pasted in Settings → API keys sends every Boat REST call here, translated to the Instabox
// API (https://instabox.sh/docs/api.md, checked 2026-11-12): machines instead of sandboxes, operations instead of
// deletion operations, /exec instead of /commands. The answers come back in Boat's shape, so the rest of the app is
// unchanged. Instabox cannot rename a machine, so the create carries the name (see `instaboxCreateName`).
import { createHash, randomUUID } from "node:crypto";

export const INSTABOX_API = "https://api.instabox.sh";
/** Instabox's free plan creates only from agent-browser, android, omarchy or ci (refused with template_not_allowed, seen
 * 2026-11-12): universal first, then agent-browser, a Linux desktop with a browser. */
export const INSTABOX_TEMPLATES = ["universal", "agent-browser"] as const;
const DESKTOP_WIDTH = 1280;
const DESKTOP_HEIGHT = 800;
const EXEC_MAX_SECONDS = 600;
const STREAM_TTL_SECONDS = 3600;
const IDLE_SUSPEND_SECONDS = 3600;
const BG_DIR = "/tmp/limix-bg";

export const isInstaboxKey = (token: string | undefined | null): boolean => typeof token === "string" && token.trim().startsWith("ibk_");

/** Boat's sandbox states, from an Instabox machine state. */
export function boatStateFromInstabox(state: unknown): string {
  switch (state) {
    case "running": return "running";
    case "creating": case "starting": case "resuming": return "provisioning";
    case "stopping": case "suspending": return "archiving";
    case "stopped": case "suspended": return "archived";
    case "deleting": return "removing";
    case "error": return "error";
    default: return "init";
  }
}

function sandboxFrom(machine: any) {
  return {
    id: String(machine?.id ?? ""),
    name: typeof machine?.name === "string" ? machine.name : "",
    state: boatStateFromInstabox(machine?.state),
    desktopAvailable: true,
    createdAt: machine?.createdAt ?? null,
  };
}

/** Boat's deletion receipts carry bdop_ + 32 hex; Instabox operations are op_…, so each gets a stable stand-in. */
const deletionOps = new Map<string, { opId: string; machineId: string }>();
export function deletionOperationId(opId: string): string {
  return `bdop_${createHash("sha256").update(opId).digest("hex").slice(0, 32)}`;
}

function deletionStatus(state: unknown): "pending" | "processing" | "completed" | "blocked" {
  if (state === "succeeded") return "completed";
  if (state === "queued") return "pending";
  if (state === "failed" || state === "cancelled") return "blocked";
  return "processing";
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Boat's error envelope ({message, error:{code}}) from Instabox's ({error:{code,message}}). */
function boatError(status: number, body: any): Response {
  const code = typeof body?.error?.code === "string" ? body.error.code : undefined;
  const message = typeof body?.error?.message === "string" ? body.error.message : `Instabox ${status}`;
  const scopes = Array.isArray(body?.error?.requiredScopes) ? ` (key needs: ${body.error.requiredScopes.join(", ")})` : "";
  const hint = typeof body?.error?.hint === "string" ? ` ${body.error.hint}` : "";
  // Boat's 403 means "wrong key" to the rest of the app; Instabox's 403 is a missing scope, unaccepted terms or a plan
  // limit, so it travels as 409 and keeps Instabox's own words.
  return json(status === 403 ? 409 : status, { ok: false, message: `Instabox: ${message}${scopes}${hint}${code ? ` [${code}]` : ""}`, error: { code, message } });
}

interface Call { method?: string; body?: unknown; idempotent?: boolean; headers?: Record<string, string>; signal?: AbortSignal | null }

async function ib(token: string, path: string, call: Call = {}): Promise<{ status: number; ok: boolean; body: any; raw: Response }> {
  const headers: Record<string, string> = { "X-API-Key": token, ...call.headers };
  if (call.body !== undefined) headers["content-type"] = "application/json";
  if (call.idempotent) headers["Idempotency-Key"] ??= randomUUID();
  const raw = await fetch(`${INSTABOX_API}${path}`, {
    method: call.method ?? "GET",
    headers,
    body: call.body === undefined ? undefined : JSON.stringify(call.body),
    signal: call.signal ?? undefined,
  });
  const body = raw.headers.get("content-type")?.includes("json") ? await raw.clone().json().catch(() => null) : null;
  return { status: raw.status, ok: raw.ok, body, raw };
}

/** Commands run with DISPLAY pointed at the machine's X server, wherever Instabox started it. */
const WITH_DISPLAY = 'if [ -z "$DISPLAY" ]; then for s in /tmp/.X11-unix/X*; do [ -e "$s" ] && export DISPLAY=":${s##*X}" && break; done; fi; ';

async function exec(token: string, machineId: string, cmd: string, timeoutSeconds: number, signal?: AbortSignal | null) {
  return ib(token, `/v1/machines/${machineId}/exec`, {
    method: "POST",
    body: { cmd: WITH_DISPLAY + cmd, timeoutSeconds: Math.max(1, Math.min(EXEC_MAX_SECONDS, Math.round(timeoutSeconds))), noHistory: true },
    signal,
  });
}

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

/** The screen tools the computer-use driver calls; installed once per machine, quietly, if the template lacks them. */
const SCREEN_TOOLS =
  "command -v xdotool >/dev/null && command -v xclip >/dev/null && (command -v scrot || command -v import || command -v ffmpeg) >/dev/null"
  + " || { S=; [ \"$(id -u)\" = 0 ] || S='sudo -n'; $S apt-get update -qq >/dev/null 2>&1;"
  + " DEBIAN_FRONTEND=noninteractive $S apt-get install -y -qq xdotool xclip scrot imagemagick >/dev/null 2>&1; }; command -v xdotool >/dev/null";
const toolsReady = new Set<string>();

async function startDesktop(token: string, machineId: string, signal?: AbortSignal | null): Promise<"ready" | "provisioning" | Response> {
  const status = await ib(token, `/v1/machines/${machineId}/desktop`, { method: "POST", body: { action: "status" }, signal });
  if (!status.ok) return boatError(status.status, status.body);
  const running = status.body?.running === true || status.body?.state === "running";
  if (!running) {
    const started = await ib(token, `/v1/machines/${machineId}/desktop`, {
      method: "POST", body: { action: "start", width: DESKTOP_WIDTH, height: DESKTOP_HEIGHT }, signal,
    });
    if (!started.ok) {
      if (started.status === 409 || started.status === 202) return "provisioning";
      return boatError(started.status, started.body);
    }
    if (!(started.body?.running === true || started.body?.state === "running")) return "provisioning";
  }
  if (!toolsReady.has(machineId)) {
    const tools = await exec(token, machineId, SCREEN_TOOLS, 300, signal);
    if (tools.ok && tools.body?.exitCode === 0) toolsReady.add(machineId);
  }
  return "ready";
}

/** POST /sandboxes/{id}/commands with detached: the process writes its output and exit code under /tmp/limix-bg. */
async function startDetached(token: string, machineId: string, command: string, signal?: AbortSignal | null): Promise<Response> {
  const processId = Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000);
  const base = `${BG_DIR}/${processId}`;
  const script = `mkdir -p ${BG_DIR}; ( bash -lc ${shellQuote(command)} > ${base}.out 2> ${base}.err; echo $? > ${base}.exit ) </dev/null >/dev/null 2>&1 & echo started`;
  const res = await exec(token, machineId, script, 30, signal);
  if (!res.ok) return boatError(res.status, res.body);
  if (!/started/.test(String(res.body?.stdout ?? ""))) return json(502, { ok: false, message: "Instabox did not start the command" });
  return json(200, { processId });
}

async function readDetached(token: string, machineId: string, processId: string, tailBytes: number, signal?: AbortSignal | null): Promise<Response> {
  if (!/^\d{1,16}$/.test(processId)) return json(404, { ok: false, message: "unknown process" });
  const base = `${BG_DIR}/${processId}`;
  const n = Math.max(1, Math.min(1_000_000, tailBytes));
  const script = `[ -e ${base}.out ] || { echo GONE; exit 0; }; printf 'EXIT:%s\\n' "$(cat ${base}.exit 2>/dev/null)";`
    + ` printf 'OUT:'; tail -c ${n} ${base}.out | base64 -w0; printf '\\nERR:'; tail -c ${n} ${base}.err | base64 -w0; echo`;
  const res = await exec(token, machineId, script, 30, signal);
  if (!res.ok) return boatError(res.status, res.body);
  const out = String(res.body?.stdout ?? "");
  if (out.startsWith("GONE")) return json(404, { ok: false, message: "unknown process" });
  const field = (key: string) => out.match(new RegExp(`^${key}:(.*)$`, "m"))?.[1]?.trim() ?? "";
  const exit = field("EXIT");
  const decode = (b64: string) => Buffer.from(b64, "base64").toString("utf8");
  const running = exit === "";
  return json(200, {
    running,
    exitCode: running ? null : Number.parseInt(exit, 10),
    stdout: decode(field("OUT")),
    stderr: decode(field("ERR")),
  });
}

/** Boat's request (path relative to its API, with its method, headers and JSON body) answered by Instabox. */
export async function instaboxFetch(rawToken: string, path: string, opts: RequestInit = {}): Promise<Response> {
  const token = rawToken.trim();
  const method = (opts.method ?? "GET").toUpperCase();
  const signal = opts.signal;
  const url = new URL(path, "http://boat.invalid");
  const parts = url.pathname.split("/").filter(Boolean);
  const reqHeaders = new Headers(opts.headers);
  let reqBody: any = null;
  if (typeof opts.body === "string" && opts.body) {
    try { reqBody = JSON.parse(opts.body); } catch { reqBody = null; }
  }

  if (parts[0] === "deletion-operations" && parts.length === 2 && method === "GET") {
    const known = deletionOps.get(parts[1]);
    if (!known) return json(404, { ok: false, message: "unknown deletion operation" });
    const op = await ib(token, `/v1/operations/${known.opId}`, { signal });
    if (op.status === 404) return json(200, { operation: { id: parts[1], kind: "sandbox", targetId: known.machineId, status: "completed", stage: "completed" } });
    if (!op.ok) return boatError(op.status, op.body);
    const status = deletionStatus(op.body?.state);
    return json(200, { operation: { id: parts[1], kind: "sandbox", targetId: known.machineId, status, stage: status === "completed" ? "completed" : status === "blocked" ? "retrying" : "removing" } });
  }

  if (parts[0] !== "sandboxes") return json(404, { ok: false, message: `Instabox has no equivalent of ${path}` });

  if (parts.length === 1) {
    if (method === "GET") {
      const q = new URLSearchParams();
      const limit = url.searchParams.get("limit");
      const cursor = url.searchParams.get("cursor");
      if (limit) q.set("limit", String(Math.min(100, Number(limit) || 100)));
      if (cursor) q.set("cursor", cursor);
      const listed = await ib(token, `/v1/machines${q.toString() ? `?${q}` : ""}`, { signal });
      if (!listed.ok) return boatError(listed.status, listed.body);
      const machines = Array.isArray(listed.body?.machines) ? listed.body.machines : [];
      return json(200, { sandboxes: machines.map(sandboxFrom), pageInfo: { nextCursor: listed.body?.nextCursor ?? null } });
    }
    if (method === "POST") {
      const name = typeof reqBody?.name === "string" ? reqBody.name : undefined;
      const key = reqHeaders.get("Idempotency-Key");
      let created!: Awaited<ReturnType<typeof ib>>;
      for (const templateId of INSTABOX_TEMPLATES) {
        created = await ib(token, "/v1/machines", {
          method: "POST",
          idempotent: true,
          headers: key ? { "Idempotency-Key": `${key}-${templateId}` } : {},
          body: { ...(name ? { name } : {}), templateId, autoSuspendAfterSeconds: IDLE_SUSPEND_SECONDS, desiredState: "running" },
          signal,
        });
        if (created.body?.error?.code !== "template_not_allowed") break;
      }
      if (!created.ok) {
        if (created.status === 409 && created.body?.error?.code === "idempotency_in_progress") return json(409, { ok: false, error: { code: "idempotency_in_progress" } });
        return boatError(created.status, created.body);
      }
      const machineId = created.body?.machineId ?? created.body?.id;
      if (typeof machineId !== "string") return json(502, { ok: false, message: "Instabox did not say which machine it created" });
      return json(201, { sandbox: { id: machineId, name: name ?? "", state: "provisioning", desktopAvailable: true } });
    }
  }

  const machineId = parts[1];
  if (!/^m_[a-z0-9]{20,40}$/.test(machineId ?? "")) return json(404, { ok: false, message: "not an Instabox machine id" });

  if (parts.length === 2) {
    if (method === "GET") {
      const got = await ib(token, `/v1/machines/${machineId}`, { signal });
      if (!got.ok) return got.status === 404 ? json(404, { ok: false, message: "not found" }) : boatError(got.status, got.body);
      return json(200, { sandbox: sandboxFrom(got.body) });
    }
    if (method === "PATCH") {
      // The name was given at create; Instabox names cannot change afterwards.
      const got = await ib(token, `/v1/machines/${machineId}`, { signal });
      if (!got.ok) return boatError(got.status, got.body);
      if (typeof reqBody?.name === "string" && got.body?.name !== reqBody.name) {
        return json(409, { ok: false, message: "Instabox cannot rename a machine; delete it and let Limix Bot create a new one" });
      }
      return json(200, { sandbox: sandboxFrom(got.body) });
    }
    if (method === "DELETE") {
      const removed = await ib(token, `/v1/machines/${machineId}`, { method: "DELETE", idempotent: true, headers: { "X-Confirm-Delete": machineId }, signal });
      if (removed.status === 404 || removed.status === 410) return json(404, { ok: false, message: "not found" });
      if (!removed.ok) return boatError(removed.status, removed.body);
      const opId = typeof removed.body?.id === "string" ? removed.body.id : null;
      if (!opId) return json(202, { operation: { id: deletionOperationId(machineId), kind: "sandbox", targetId: machineId, status: "completed", stage: "completed" } });
      const id = deletionOperationId(opId);
      deletionOps.set(id, { opId, machineId });
      const status = deletionStatus(removed.body?.state);
      return json(202, { operation: { id, kind: "sandbox", targetId: machineId, status, stage: status === "completed" ? "completed" : "removing" } });
    }
  }

  const action = parts.slice(2).join("/");
  if (method === "POST" && (action === "resume" || action === "stop")) {
    let verb = action === "stop" ? "stop" : "start";
    if (action === "resume") {
      const got = await ib(token, `/v1/machines/${machineId}`, { signal });
      if (got.ok && got.body?.state === "suspended") verb = "resume";
    }
    const res = await ib(token, `/v1/machines/${machineId}/${verb}`, { method: "POST", idempotent: true, body: {}, signal });
    if (!res.ok) return res.status === 409 ? json(409, { ok: false, message: "busy" }) : boatError(res.status, res.body);
    return json(202, { ok: true });
  }

  if (method === "POST" && action === "desktop") {
    const started = await startDesktop(token, machineId, signal);
    if (started instanceof Response) return started;
    if (started === "provisioning") return json(200, { provisioning: true });
    const stream = await ib(token, `/v1/machines/${machineId}/desktop/stream`, {
      method: "POST", body: { viewOnly: false, ttlSeconds: STREAM_TTL_SECONDS }, signal,
    });
    if (!stream.ok) return boatError(stream.status, stream.body);
    return json(200, { desktopUrl: typeof stream.body?.url === "string" ? stream.body.url : null });
  }

  if (method === "POST" && action === "commands") {
    const command = typeof reqBody?.command === "string" ? reqBody.command : "";
    if (reqBody?.detached === true) return startDetached(token, machineId, command, signal);
    const res = await exec(token, machineId, command, EXEC_MAX_SECONDS, signal);
    if (!res.ok) return boatError(res.status, res.body);
    return json(200, { exitCode: res.body?.exitCode ?? null, stdout: res.body?.stdout ?? "", stderr: res.body?.stderr ?? "", ...(res.body?.timedOut ? { timedOut: true } : {}) });
  }

  if (method === "GET" && parts[2] === "commands" && parts.length === 4) {
    return readDetached(token, machineId, parts[3], Number(url.searchParams.get("tailBytes") ?? 4096), signal);
  }

  if (method === "GET" && (action === "artifacts" || action === "files")) {
    const filePath = url.searchParams.get("path") ?? "";
    if (!filePath.startsWith("/")) return json(400, { ok: false, message: "absolute path required" });
    const direct = await ib(token, `/v1/machines/${machineId}/files/content?path=${encodeURIComponent(filePath)}`, { signal });
    if (direct.ok && !direct.raw.headers.get("content-type")?.includes("json")) {
      const bytes = Buffer.from(await direct.raw.arrayBuffer());
      if (action === "files") return json(200, { content: bytes.toString("base64") });
      return new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "application/octet-stream" } });
    }
    const res = await exec(token, machineId, `base64 -w0 ${shellQuote(filePath)}`, 60, signal);
    if (!res.ok) return boatError(res.status, res.body);
    if (res.body?.exitCode !== 0) return json(404, { ok: false, message: "file not found" });
    const content = String(res.body?.stdout ?? "").trim();
    if (action === "files") return json(200, { content });
    return new Response(new Uint8Array(Buffer.from(content, "base64")), { status: 200, headers: { "content-type": "application/octet-stream" } });
  }

  if (method === "POST" && (action === "files/download-url" || action === "files/upload-url")) {
    return json(501, { ok: false, code: "not_available", error: { code: "not_available" } });
  }

  return json(404, { ok: false, message: `Instabox has no equivalent of ${method} ${url.pathname}` });
}

/** Instabox checks a key with GET /v1/me. */
export async function verifyInstaboxKey(rawToken: string): Promise<{ ok: true } | { ok: false; message: string; rejected?: true }> {
  const token = rawToken.trim();
  try {
    const res = await fetch(`${INSTABOX_API}/v1/me`, { headers: { "X-API-Key": token }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, rejected: true, message: "Instabox rejected that key — it may have been revoked. Create a new one at instabox.sh with the machines scopes." };
    }
    return { ok: false, message: `Instabox returned ${res.status} for that key — try again in a moment.` };
  } catch {
    return { ok: false, message: "Couldn't reach Instabox to check that key — check your connection and retry." };
  }
}
