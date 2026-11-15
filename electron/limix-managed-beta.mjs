const CONTROL_PLANE = "https://accounts.limixmedia.com/v1/managed-cloud/workspace";
const STATES = ["available", "queued", "starting", "running", "waiting_capacity", "host_unreachable", "failed", "routing"];
const HOME_ORIGIN = /^https:\/\/lc-[0-9a-f]{32}\.limixmedia\.com$/;

export async function managedBetaState(credential, requestHome = false, send = fetch) {
  if (!credential) return "hidden";
  const response = await send(CONTROL_PLANE, {
    method: requestHome ? "POST" : "GET",
    headers: { authorization: "Bearer " + credential.bearer },
    redirect: "error", signal: AbortSignal.timeout(8000),
  });
  if ([401, 403, 404].includes(response.status)) return "hidden";
  if (!response.ok) throw new Error("Cloud status temporarily unavailable");
  const { state } = await response.json();
  if (!STATES.includes(state)) throw new Error("Unknown Cloud state");
  return state;
}

/** The account Worker grants this account's own home; the home turns the grant into one pairing credential. */
export async function openManagedHome(credential, send = fetch) {
  if (!credential) return { ok: false, state: "hidden" };
  const granted = await send(CONTROL_PLANE + "/open", {
    method: "POST", headers: { authorization: "Bearer " + credential.bearer },
    redirect: "error", signal: AbortSignal.timeout(10000),
  });
  if ([401, 403, 404].includes(granted.status)) return { ok: false, state: "hidden" };
  const answer = await granted.json().catch(() => null);
  if (granted.status === 409 && STATES.includes(answer?.state)) return { ok: false, state: answer.state };
  if (!granted.ok || typeof answer?.grant !== "string" || !HOME_ORIGIN.test(answer?.origin ?? "")) throw new Error("Cloud access temporarily unavailable");
  const redeemed = await send(answer.origin + "/api/limix/managed/grant", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ grant: answer.grant }),
    redirect: "error", credentials: "omit", signal: AbortSignal.timeout(15000),
  });
  const pairing = await redeemed.json().catch(() => null);
  if (!redeemed.ok || typeof pairing?.credential !== "string") throw new Error("The Cloud environment did not accept this sign-in");
  return { ok: true, origin: answer.origin, credential: pairing.credential };
}
