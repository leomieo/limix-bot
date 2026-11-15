import { createHmac, createPrivateKey, randomUUID, sign } from "node:crypto";
import { request } from "node:http";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { grantPublicKey } from "./host.mjs";

const file = fileURLToPath(new URL("./compose.yaml", import.meta.url));
const hostToken = "fixture-host-token-" + randomUUID();
const ids = [randomUUID(), randomUUID()];
const projects = ids.map(id => "limix-fixture-" + id);
const homeOrigin = id => `https://lc-${id.replace(/-/g, "")}.fixture.invalid`;
const homeEnv = project => {
  const id = project.slice("limix-fixture-".length);
  return { ...process.env, LIMIX_HOME_ID: id, LIMIX_HOME_ORIGIN: homeOrigin(id), LIMIX_GRANT_PUBLIC_KEY: grantPublicKey(hostToken) };
};
function compose(project, ...args) {
  return execFileSync("docker", ["compose", "-f", file, "-p", project, ...args],
    { encoding: "utf8", windowsHide: true, timeout: 240000, env: homeEnv(project) }).trim();
}
function grantFor(id, aud = homeOrigin(id)) {
  const seed = createHmac("sha256", hostToken).update("limix-managed-grant-ed25519-v1").digest();
  const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]), format: "der", type: "pkcs8" });
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, ws: id, sub: "limix:fixture", aud, iat: now, exp: now + 90, nonce: randomUUID().replace(/-/g, "") })).toString("base64url");
  return payload + "." + sign(null, Buffer.from("limix-managed-grant.v1." + payload), key).toString("base64url");
}
// The tunnel reaches the edge with the public name and https; this sends the same headers to the loopback port.
function viaTunnel(address, id, path, body, token) {
  const [host, port] = address.replace("http://", "").split(":");
  return new Promise((resolve, reject) => {
    const req = request({ host, port: Number(port), path, method: body ? "POST" : "GET", headers: {
      host: new URL(homeOrigin(id)).host, "x-forwarded-proto": "https", "x-forwarded-for": "203.0.113.7",
      ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: "Bearer " + token } : {}) } }, res => {
      let text = "";
      res.on("data", chunk => { text += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null }));
    });
    req.on("error", reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
try { execFileSync("docker", ["network", "inspect", "limix-managed-edge"], { stdio: "ignore", windowsHide: true }); }
catch { execFileSync("docker", ["network", "create", "limix-managed-edge"], { stdio: "ignore", windowsHide: true }); }
function execute(project, ...args) {
  return compose(project, "exec", "-T", "home", ...args);
}
const origins = [];
try {
  for (const project of projects) {
    compose(project, "up", "-d", "--no-build", "--wait", "--wait-timeout", "150");
    const address = compose(project, "port", "edge", "8080");
    origins.push("http://" + address);
    assert.match(address, /^127\.0\.0\.1:\d+$/);
    assert.equal((await fetch("http://" + address + "/api/health")).status, 200);
    const restricted = await fetch("http://" + address + "/api/bots", { redirect: "manual" });
    assert([401, 403].includes(restricted.status), "Private edge requires a paired session");
    execute(project, "codex", "--version");
    execute(project, "claude", "--version");
    execute(project, "sh", "-ec", "test ! -S /var/run/docker.sock && test -w /data");
  }
  const [a, b] = projects;
  console.log(execute(a, "node", "--input-type=module", "-e", readFileSync(new URL("./smoke-antigravity.mjs", import.meta.url), "utf8")));
  // The API receives a synthetic key on an isolated operator connection; no upstream inference is needed.
  const fakeKey = "fixture-" + randomUUID();
  const keyConfig = { displayName: "Isolation fixture", url: "https://example.invalid/v1", models: ["fixture"], key: fakeKey };
  const created = execute(a, "curl", "-fsS", "-H", "content-type: application/json", "-d",
    JSON.stringify(keyConfig), "http://127.0.0.1:8799/api/instances/openai-compat");
  assert(!created.includes(fakeKey));
  const { instanceId } = JSON.parse(created);
  assert.match(instanceId, /^openai-compat-/);
  const verifyKey = `const fs=require('node:fs');const file=process.env.OMB_DATA_DIR+'/config.json';const cfg=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};const key=cfg.instances?.[process.argv[1]]?.config?.key;process.exit(key===process.argv[2]?0:1)`;
  execute(b, "node", "-e", verifyKey, instanceId);
  const issued = JSON.parse(execute(a, "curl", "-fsS", "-H", "content-type: application/json",
    "-d", JSON.stringify({ scopes: ["client"] }), "http://127.0.0.1:8799/api/auth/pairing"));
  assert.equal(typeof issued.code, "string");
  const pair = await fetch(origins[0] + "/api/auth/pair", { method: "POST",
    headers: { "content-type": "application/json" }, body: JSON.stringify({ code: issued.code, label: "fixture A" }) });
  assert.equal(pair.status, 200);
  const { token } = await pair.json();
  assert.equal(typeof token, "string");
  const options = { headers: { authorization: "Bearer " + token } };
  assert.equal((await fetch(origins[0] + "/api/bots", options)).status, 200);
  assert([401, 403].includes((await fetch(origins[1] + "/api/bots", options)).status));
  execute(a, "sh", "-ec", "mkdir -p /data/.codex && echo fixture > /data/.codex/limix-isolation-test");
  execute(b, "sh", "-ec", "test ! -e /data/.codex/limix-isolation-test");
  const [idA, idB] = ids;
  assert.equal((await viaTunnel(origins[1], idB, "/api/limix/managed/grant", { grant: grantFor(idA) })).status, 403, "B's home refuses A's grant");
  assert.equal((await viaTunnel(origins[1], idB, "/api/limix/managed/grant", { grant: grantFor(idB, homeOrigin(idA)) })).status, 403, "a grant for another address is refused");
  const grantA = grantFor(idA);
  const redeemed = await viaTunnel(origins[0], idA, "/api/limix/managed/grant", { grant: grantA });
  assert.equal(redeemed.status, 200);
  assert.equal((await viaTunnel(origins[0], idA, "/api/limix/managed/grant", { grant: grantA })).status, 401, "a grant opens one pairing only");
  const paired = await viaTunnel(origins[0], idA, "/api/auth/pair", { code: redeemed.body.credential, label: "fixture Cloud A" });
  assert.equal(paired.status, 200);
  assert.equal((await viaTunnel(origins[0], idA, "/api/bots", null, paired.body.token)).status, 200);
  assert([401, 403].includes((await viaTunnel(origins[1], idB, "/api/bots", null, paired.body.token)).status), "A's Cloud session is refused by B");
  compose(a, "up", "-d", "--no-build", "--force-recreate", "--wait", "--wait-timeout", "150");
  assert.equal(execute(a, "cat", "/data/.codex/limix-isolation-test"), "fixture");
  execute(a, "node", "-e", verifyKey, instanceId, fakeKey);
  console.log("PASS: account grant opens only its own home, API key isolated and retained, two real servers and gateways healthy, Codex and Claude installed, independent HOME volumes, persistence after recreation");
} finally {
  for (const project of projects) compose(project, "down", "-v");
}
