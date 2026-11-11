// Sign-in with the Limix Studio account (the same account the desktop app signs in with), in place of the e-mail code.
// The app sends `Authorization: Bearer limix.<base64url machine id>.<token>`; this asks the account server whether that
// computer's sign-in is still live, then maps the account to a row in the "user" table so installations keep working.
import { HTTPError } from "./http";

export const LIMIX_BEARER = /^Bearer\s+limix\.([A-Za-z0-9_-]{1,200})\.([A-Za-z0-9_.~-]{8,256})$/i;

export interface LimixSession {
  user: { id: string; email: string; name: string; emailVerified: boolean };
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)));
}

/** The account name made safe for an id and an address: lowercase letters, digits, dot, dash, underscore. */
export function limixUserKey(username: string): string | null {
  const key = username.trim().toLowerCase();
  return /^[a-z0-9._-]{1,64}$/.test(key) ? key : null;
}

export async function limixSession(request: Request, env: Env): Promise<LimixSession | null> {
  const match = request.headers.get("authorization")?.match(LIMIX_BEARER);
  if (!match) return null;
  const base = String((env as unknown as Record<string, unknown>).LIMIX_ACCOUNT_URL ?? "").replace(/\/+$/, "");
  if (!base.startsWith("https://")) throw new HTTPError(503, "limix_account_unavailable");
  let machineId: string;
  try { machineId = fromBase64Url(match[1]); } catch { return null; }
  let answer: { valid?: boolean; username?: string } | null = null;
  try {
    const response = await fetch(`${base}/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: match[2], machine_id: machineId }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok && response.status >= 500) throw new HTTPError(503, "limix_account_unavailable");
    answer = await response.json().catch(() => null);
  } catch (error) {
    if (error instanceof HTTPError) throw error;
    throw new HTTPError(503, "limix_account_unavailable");
  }
  if (!answer?.valid || typeof answer.username !== "string") return null;
  const key = limixUserKey(answer.username);
  if (!key) return null;
  const id = `limix:${key}`;
  const email = `${key}@limix.invalid`;
  const now = new Date().toISOString();
  // The installations table points at "user"; make sure this account has its row (created once, never changed).
  await env.DB.prepare(
    `INSERT OR IGNORE INTO "user" ("id","name","email","emailVerified","createdAt","updatedAt") VALUES (?,?,?,1,?,?)`,
  ).bind(id, key, email, now, now).run();
  return { user: { id, email, name: key, emailVerified: true } };
}
