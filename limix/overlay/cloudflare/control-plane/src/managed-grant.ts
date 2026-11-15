// A Cloud beta home trusts only this signature: the desktop carries the grant to the home, which opens one pairing.
// The Ed25519 seed is derived from LIMIX_BETA_HOST_TOKEN, so the Xeon host can hand the public key to each home and
// no secret ever enters a home container.
const PKCS8_ED25519_PREFIX = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
export const GRANT_SEED_LABEL = "limix-managed-grant-ed25519-v1";
export const GRANT_SIGNED_PREFIX = "limix-managed-grant.v1.";
export const GRANT_TTL_SECONDS = 90;
const encoder = new TextEncoder();

export interface ManagedGrantClaims {
  v: 1;
  ws: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  nonce: string;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function managedHomeHostname(workspaceId: string, suffix: string): string {
  return `lc-${workspaceId.replace(/-/g, "")}.${suffix}`;
}

export function managedHomeOrigin(workspaceId: string, suffix: string): string {
  return `https://${managedHomeHostname(workspaceId, suffix)}`;
}

/** The edge container's alias on the host's shared Docker network. */
export function managedHomeService(workspaceId: string): string {
  return `http://edge-${workspaceId}:8080`;
}

async function signingKey(hostToken: string): Promise<CryptoKey> {
  const mac = await crypto.subtle.importKey("raw", encoder.encode(hostToken), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const seed = new Uint8Array(await crypto.subtle.sign("HMAC", mac, encoder.encode(GRANT_SEED_LABEL)));
  const der = new Uint8Array(PKCS8_ED25519_PREFIX.length + seed.length);
  der.set(PKCS8_ED25519_PREFIX);
  der.set(seed, PKCS8_ED25519_PREFIX.length);
  return crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
}

export async function signManagedGrant(hostToken: string, input: { workspaceId: string; principal: string; origin: string; now?: number }): Promise<{ grant: string; expiresAt: number }> {
  const iat = Math.floor((input.now ?? Date.now()) / 1000);
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(24)));
  const claims: ManagedGrantClaims = { v: 1, ws: input.workspaceId, sub: input.principal, aud: input.origin, iat, exp: iat + GRANT_TTL_SECONDS, nonce };
  const payload = base64url(encoder.encode(JSON.stringify(claims)));
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", await signingKey(hostToken), encoder.encode(GRANT_SIGNED_PREFIX + payload)));
  return { grant: `${payload}.${base64url(signature)}`, expiresAt: claims.exp * 1000 };
}
