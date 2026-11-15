import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const freePort = () => new Promise((resolve) => { const s = createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test("a connector started by the app stops when the app goes away, freeing its port", async () => {
  const dir = mkdtempSync(join(tmpdir(), "limix-gw-exit-"));
  const port = await freePort();
  const child = spawn(process.execPath, [fileURLToPath(new URL("../src/main.mjs", import.meta.url))], {
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: { ...process.env, LIMIX_DATA_DIR: dir, LIMIX_PORT: String(port), LIMIX_NO_BROWSER: "1" },
  });
  try {
    await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => { if (String(chunk).includes(String(port))) resolve(); });
      child.on("exit", (code) => reject(new Error(`exited early (${code})`)));
      setTimeout(() => reject(new Error("did not start")), 10_000);
    });
    const exited = new Promise((resolve) => child.on("exit", resolve));
    child.disconnect();
    const code = await Promise.race([exited, new Promise((resolve) => setTimeout(() => resolve("still running"), 6_000))]);
    assert.equal(code, 0);
  } finally {
    child.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});
