import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { channel } from "node:diagnostics_channel";
import { once } from "node:events";
import { access } from "node:fs/promises";
import { connect, createServer } from "node:net";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { limixNativeResource } from "../server/limix-native-path.ts";

const script = fileURLToPath(import.meta.url);
const executable = limixNativeResource(process.platform === "win32" ? "limix-process-sampler.exe" : "limix-process-sampler");
const execFileAsync = promisify(execFile);
const timeout = () => AbortSignal.timeout(8_000);

function startFixtureProcess(role, port) {
  return spawn(process.execPath, [script, role, String(port)], {
    env: { SystemRoot: process.env.SystemRoot }, windowsHide: true, stdio: "ignore",
  });
}

async function holdConnection(role, port) {
  const socket = connect(port, "127.0.0.1");
  let leaf;
  let leafClosed;
  try {
    await once(socket, "connect", { signal: timeout() });
    const closed = once(socket, "close");
    socket.write(role + "\n");
    if (role === "root") {
      leaf = startFixtureProcess("leaf", port);
      leafClosed = new Promise((resolve) => leaf.once("close", resolve));
      leaf.once("error", () => socket.destroy());
    }
    socket.resume();
    await closed;
  } finally {
    socket.destroy();
    leaf?.kill();
    await leafClosed;
  }
}

async function rustSample(pid, since) {
  const args = [String(pid)];
  if (since !== undefined) args.push(String(since));
  const { stdout } = await execFileAsync(executable, args, { windowsHide: true, timeout: 8_000, maxBuffer: 1024 });
  return JSON.parse(stdout);
}

function checkSample(sample, connections) {
  if (connections === null) {
    assert.deepEqual(sample, { cpuMs: null, connections: null });
  } else {
    assert.equal(sample.connections, connections);
    assert.ok(Number.isFinite(sample.cpuMs) && sample.cpuMs > 0, "expected CPU time from the fixture processes");
  }
}

async function verifyDefaultBackend(sampleProcessTree, pid) {
  const children = channel("child_process");
  const programs = [];
  function record({ process: child }) {
    child.once("spawn", () => programs.push(basename(child.spawnfile).toLowerCase()));
  }
  children.subscribe(record);
  delete process.env.LIMIX_ACP_PROCESS_SAMPLER;
  try {
    checkSample(await sampleProcessTree(pid), 2);
    assert.deepEqual(programs, [basename(executable)], "the default host call must reach the Rust sampler");
  } finally {
    process.env.LIMIX_ACP_PROCESS_SAMPLER = "typescript";
    children.unsubscribe(record);
  }
}

async function verifyParity(legacy, pid, since) {
  for (const [cutoff, connections] of [[undefined, 2], [since, 1], [Date.now() + 60_000, null]]) {
    const before = await legacy(pid, cutoff);
    const native = await rustSample(pid, cutoff);
    const after = await legacy(pid, cutoff);
    for (const result of [before, native, after]) checkSample(result, connections);
    if (connections !== null) {
      // macOS ps rounds CPU time to hundredths of a second for each process.
      const tolerance = connections * (process.platform === "darwin" ? 10 : 1);
      assert.ok(native.cpuMs >= before.cpuMs - tolerance && native.cpuMs <= after.cpuMs + tolerance,
        `Rust CPU ${native.cpuMs} ms outside bracket [${before.cpuMs}, ${after.cpuMs}] ms`);
    }
  }
}

async function timeBatches(legacy, pid, parallelism) {
  const runners = { legacy, rust: rustSample };
  const samples = { legacy: [], rust: [] };
  for (let round = 0; round < 4; round++) {
    const order = round % 2 === 0 ? ["legacy", "rust"] : ["rust", "legacy"];
    for (const name of order) {
      const start = performance.now();
      const results = await Promise.all(Array.from({ length: parallelism }, () => runners[name](pid)));
      samples[name].push(performance.now() - start);
      for (const result of results) checkSample(result, 2);
    }
  }
  const medianBatchMs = {};
  for (const [name, times] of Object.entries(samples)) {
    const sorted = times.toSorted((a, b) => a - b);
    medianBatchMs[name] = Number(((sorted[1] + sorted[2]) / 2).toFixed(2));
  }
  return { parallelism, batchesPerBackend: 4, medianBatchMs };
}

async function benchmark() {
  await access(executable);
  process.env.LIMIX_ACP_PROCESS_SAMPLER = "typescript";
  const { sampleProcessTree } = await import("../server/drivers/acp/quiet-status.ts");
  const peers = new Set();
  const ready = new Set();
  const server = createServer((socket) => {
    peers.add(socket);
    socket.once("close", () => peers.delete(socket));
    socket.setEncoding("utf8");
    let message = "";
    socket.on("data", (part) => {
      message += part;
      if (message === "root\n" || message === "leaf\n") {
        ready.add(message.trim());
        if (ready.size === 2) server.emit("fixture-ready");
      } else if (message.length > 5) socket.destroy();
    });
  });
  let root;
  let rootClosed;
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening", { signal: timeout() });
    const since = Date.now();
    root = startFixtureProcess("root", server.address().port);
    rootClosed = once(root, "close");
    await Promise.race([
      once(server, "fixture-ready", { signal: timeout() }),
      rootClosed.then(() => { throw new Error("fixture root exited before both sockets connected"); }),
    ]);
    await verifyParity(sampleProcessTree, root.pid, since);
    await verifyDefaultBackend(sampleProcessTree, root.pid);
    const timings = [];
    for (const parallelism of [1, 4]) timings.push(await timeBatches(sampleProcessTree, root.pid, parallelism));
    console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
      fixture: "Two idle processes with one established loopback client each",
      parity: ["whole tree", "descendant since cutoff", "empty selection", "default host call"],
      timings,
    }, null, 2));
  } finally {
    for (const socket of peers) socket.destroy();
    server.close();
    if (root) {
      const stop = setTimeout(() => root.kill(), 2_000);
      try { await rootClosed; } finally { clearTimeout(stop); }
    }
  }
}

const [, , role, port] = process.argv;
if (role === "root" || role === "leaf") await holdConnection(role, Number(port));
else await benchmark();
