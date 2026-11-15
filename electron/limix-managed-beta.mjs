export async function managedBetaState(credential, requestHome = false, send = fetch) {
  if (!credential) return "hidden";
  const response = await send("https://accounts.limixmedia.com/v1/managed-cloud/workspace", {
    method: requestHome ? "POST" : "GET",
    headers: { authorization: "Bearer " + credential.bearer },
    redirect: "error", signal: AbortSignal.timeout(8000),
  });
  if ([401, 403, 404].includes(response.status)) return "hidden";
  if (!response.ok) throw new Error("Cloud status temporarily unavailable");
  const { state } = await response.json();
  if (!["available", "queued", "starting", "running", "waiting_capacity", "host_unreachable", "failed"].includes(state)) {
    throw new Error("Unknown Cloud state");
  }
  return state;
}
