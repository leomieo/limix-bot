import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installedUiReady, waitForInstalledUi } from "./limix-install-ready.mjs";

test("the UI is ready only after its HTML and referenced assets have been extracted", () => {
  const root = mkdtempSync(join(tmpdir(), "limix-install-ready-"));
  try {
    assert.equal(installedUiReady(root), false);
    mkdirSync(join(root, "ui", "assets"), { recursive: true });
    writeFileSync(join(root, "ui", "index.html"), '<html><script src="/assets/app.js"></script></html>');
    assert.equal(installedUiReady(root), false);
    writeFileSync(join(root, "ui", "assets", "app.js"), "");
    assert.equal(installedUiReady(root), false);
    writeFileSync(join(root, "ui", "assets", "app.js"), "console.log('ready')");
    assert.equal(installedUiReady(root), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a slow update waits for stable files and then continues", async () => {
  let elapsed = 0, notices = 0;
  const result = await waitForInstalledUi({
    ready: () => elapsed >= 180_000, now: () => elapsed,
    sleep: async ms => { elapsed += ms; }, onWaiting: () => { notices++; },
  });
  assert.equal(result, true);
  assert.equal(notices, 1);
  assert.equal(elapsed, 180_500);
});

test("a complete installation continues immediately", async () => {
  assert.equal(await waitForInstalledUi({
    ready: () => true, onWaiting: () => assert.fail("Unexpected loading screen"),
    sleep: () => assert.fail("Unexpected wait"),
  }), true);
});

test("a damaged installation times out and closing the app cancels the wait", async () => {
  let elapsed = 0;
  const options = { ready: () => false, now: () => elapsed, sleep: async ms => { elapsed += ms; } };
  assert.equal(await waitForInstalledUi({ ...options, timeoutMs: 1000 }), false);
  assert.equal(elapsed, 1000);
  elapsed = 0;
  assert.equal(await waitForInstalledUi({ ...options, cancelled: () => elapsed >= 500 }), false);
  assert.equal(elapsed, 500);
});

test("an unstable extraction does not pass the two readiness checks", async () => {
  let elapsed = 0, reads = 0;
  assert.equal(await waitForInstalledUi({
    ready: () => ++reads % 2 === 0, now: () => elapsed,
    sleep: async ms => { elapsed += ms; }, timeoutMs: 1500,
  }), false);
});
