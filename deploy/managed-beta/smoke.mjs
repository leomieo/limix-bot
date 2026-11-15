import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("./compose.yaml", import.meta.url));
const projects = [randomUUID(), randomUUID()].map(id => "limix-fixture-" + id);
function compose(project, ...args) {
  return execFileSync("docker", ["compose", "-f", file, "-p", project, ...args],
    { encoding: "utf8", windowsHide: true, timeout: 240000 }).trim();
}
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
  compose(a, "up", "-d", "--no-build", "--force-recreate", "--wait", "--wait-timeout", "150");
  assert.equal(execute(a, "cat", "/data/.codex/limix-isolation-test"), "fixture");
  console.log("PASS: two real servers and gateways healthy, both CLIs installed, independent HOME volumes, persistence after recreation");
} finally {
  for (const project of projects) compose(project, "down", "-v");
}
