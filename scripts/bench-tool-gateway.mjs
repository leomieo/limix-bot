import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: {
  resources: { type: "string" },
  "parity-only": { type: "boolean" },
  "verify-only": { type: "boolean" },
} });
if (values.resources !== undefined) assert.ok(isAbsolute(values.resources), "--resources requires an absolute directory");
const gateFile = values.resources
  ? join(values.resources, "server", "mcp-gate.js")
  : fileURLToPath(new URL("../server/mcp-gate.ts", import.meta.url));
await access(gateFile);
const upstreamFile = fileURLToPath(new URL("./testing/gateway-benchmark-upstream.mjs", import.meta.url));
const sizes = [4 * 1024, 256 * 1024, 4 * 1024 * 1024];
const rounds = 8;
const backends = ["typescript", "rust"];
const wire = Symbol("wire");
const digest = text => createHash("sha256").update(text).digest("hex");
const marker = id => "response-" + typeof id + "-" + id + "|";
const plain = (id, size) => marker(id).padEnd(size, "x");
const call = (id, bytes, concurrency = 1, shape = "ascii", name = "read") =>
  ({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: { bytes, concurrency, shape } } });

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label + " timed out")), ms);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function startGate(home, backend, budget, checking) {
  await mkdir(home);
  const spillDir = join(home, "spill");
  const callsFile = join(home, "calls.jsonl");
  const upstream = { command: process.execPath, args: [upstreamFile],
    env: checking ? { FIXTURE_CALLS: callsFile } : {},
  };
  const child = spawn(process.execPath, ["--experimental-strip-types", gateFile], {
    cwd: home, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    env: {
      HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home,
      TMPDIR: home, TMP: home, TEMP: home, OMB_DATA_DIR: home,
      SystemRoot: process.env.SystemRoot, PATH: dirname(process.execPath),
      LIMIX_TOOL_GATEWAY: backend, OMB_GATE_NAME: "fixture",
      OMB_GATE_TOOL_SCOPE: JSON.stringify({ allow: ["mcp:fixture:read", "mcp:fixture:schema", "mcp:fixture:hidden"] }),
      OMB_GATE_UPSTREAM: JSON.stringify(upstream),
      ...(budget === "default" ? {} : { OMB_GATE_BUDGET: String(budget) }),
      ...(checking || budget === "default" ? { OMB_GATE_SPILL_DIR: spillDir } : {}),
      ...(checking ? { LIMIX_TOOL_GATEWAY_TRACE: "1" } : {}),
    },
  });
  let rustFrames = 0;
  let lastError = "";
  const diagnostic = createInterface({ input: child.stderr });
  diagnostic.on("line", line => {
    if (line.includes("mcp-gate: Rust handled large response")) rustFrames++;
    lastError = line.slice(-600);
  });
  const closed = new Promise(resolve => child.once("close", code => resolve(code)));
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  let failure;
  child.on("error", error => { failure = error; });
  child.stdin.on("error", error => { failure = error; });
  async function exchange(requests) {
    const pending = new Set(requests.map(request => request.id));
    const replies = [];
    for (const request of requests) child.stdin.write(JSON.stringify(request) + "\n");
    while (pending.size) {
      const { done, value } = await lines.next();
      if (failure) throw failure;
      assert.ok(!done, backend + " closed before replying. " + lastError);
      const frame = JSON.parse(value);
      assert.equal(frame.jsonrpc, "2.0");
      assert.ok(pending.delete(frame.id), "duplicate or unexpected response ID");
      if (checking) frame[wire] = value;
      replies.push(frame);
    }
    return replies;
  }
  async function close() {
    child.stdin.end();
    try {
      const code = await withTimeout(closed, 6_000, backend + " shutdown");
      if (failure) throw failure;
      assert.equal(code, 0, lastError);
    } catch (error) {
      child.kill();
      await withTimeout(closed, 5_000, backend + " forced shutdown");
      throw error;
    }
    return rustFrames;
  }
  return { callsFile, spillDir, close, exchange: requests => withTimeout(exchange(requests), 15_000, backend + " requests") };
}

async function verify(home, backend, budget) {
  const gate = await startGate(home, backend, budget, true);
  const whole = budget === 0;
  const snapshot = [];
  const expectedCalls = [];
  const expectedSpills = [];
  let hits;
  async function batch(requests) {
    const replies = await gate.exchange(requests);
    for (const reply of replies) snapshot.push(digest(reply[wire]));
    return replies;
  }
  try {
    const [catalog] = await batch([{ jsonrpc: "2.0", id: "list", method: "tools/list" }]);
    assert.deepEqual(catalog.result.tools.map(tool => tool.name), whole ? ["read", "schema"] : ["read", "schema", "query_result"]);
    for (const name of ["write", "hidden"]) {
      const [reply] = await batch([call("denied-" + name, sizes[0], 1, "ascii", name)]);
      assert.equal(reply.error.code, -32602);
    }
    const payloadSize = sizes[1];
    const [small] = await batch([call("small", sizes[0])]);
    expectedCalls.push({ id: "small", name: "read" });
    assert.equal(small.result.content[0].text, plain("small", sizes[0]));

    const reversed = await batch([call(7, payloadSize, 2), call("7", payloadSize, 2)]);
    expectedCalls.push({ id: 7, name: "read" }, { id: "7", name: "read" });
    assert.deepEqual(reversed.map(frame => frame.id), ["7", 7]);
    for (const frame of reversed) {
      const text = frame.result.content[0].text;
      const original = plain(frame.id, payloadSize);
      if (whole) assert.equal(digest(text), digest(original));
      else {
        assert.ok(text.length <= 8_000 && text.includes(marker(frame.id)) && text.includes("TRUNCATED"));
        expectedSpills.push(digest(original));
      }
    }
    const [custom] = await batch([call(18, payloadSize, 1, "custom-wire")]);
    expectedCalls.push({ id: 18, name: "read" });
    assert.ok(custom.result.content[0].text.includes(marker(18)));
    if (!whole) expectedSpills.push(digest(plain(18, payloadSize)));
    const cases = [["unicode", "read"], ["multi", "read"], ["structured", "read"], ["structured", "schema"]];
    for (const [shape, name] of cases) {
      const id = shape + "-" + name;
      const [frame] = await batch([call(id, payloadSize, 1, shape, name)]);
      expectedCalls.push({ id, name });
      const content = frame.result.content;
      if (shape === "unicode") {
        const original = marker(id) + 'Gió\n🙂"\\\u0000'.repeat(Math.ceil(payloadSize / 8));
        assert.ok(content[0].text.includes('Gió\n🙂"\\\u0000'));
        if (whole) assert.equal(digest(content[0].text), digest(original));
        else expectedSpills.push(digest(original));
      }
      if (shape === "multi") {
        assert.equal(content.length, 2);
        assert.equal(frame.result.isError, true);
        assert.deepEqual(frame.result._meta, { source: "fixture" });
        if (!whole) expectedSpills.push(digest(marker(id) + "a".repeat(payloadSize) + "\n" + "🙂 tiếng Việt\t".repeat(8_192)));
      }
      if (shape === "structured") {
        if (whole) assert.equal(frame.result.structuredContent.products.length, 2_048);
        else {
          assert.ok(content[0].text.includes("SHAPED"));
          const handle = content[0].text.match(/held as "(r\d+)"/)?.[1];
          assert.ok(handle);
          if (name === "schema") assert.ok(frame.result.structuredContent.products.length < 2_048);
          else assert.equal(frame.result.structuredContent, undefined);
          const [query] = await batch([{ jsonrpc: "2.0", id: "query-" + name, method: "tools/call",
            params: { name: "query_result", arguments: { result: handle, query: "products[-1].id" } } }]);
          assert.equal(query.result.content[0].text, "2047");
        }
      }
    }
    const calls = (await readFile(gate.callsFile, "utf8")).trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(calls, expectedCalls);
    if (whole) {
      await assert.rejects(readdir(gate.spillDir), { code: "ENOENT" });
    } else {
      const spills = await readdir(gate.spillDir);
      assert.equal(spills.length, 7);
      const saved = [];
      for (const path of spills) saved.push(await readFile(join(gate.spillDir, path), "utf8"));
      const hashes = saved.map(digest).sort();
      for (const hash of expectedSpills) assert.ok(hashes.includes(hash), "the complete payload must be saved");
      for (const text of saved.filter(text => text.startsWith("{"))) {
        const { products } = JSON.parse(text);
        assert.equal(products.length, 2_048);
        assert.equal(products.at(-1).id, 2_047);
      }
      snapshot.push(...hashes);
    }
  } finally {
    hits = await gate.close();
  }
  if (backend === "typescript") assert.equal(hits, 0);
  else assert.ok(hits >= 2, "Rust must handle large responses; build and stage the native gateway before running. Observed " + hits);
  return { snapshot, hits };
}

async function closeGates(gates) {
  const closed = await Promise.allSettled(Object.values(gates).map(gate => gate.close()));
  for (const result of closed) if (result.status === "rejected") throw result.reason;
}

async function measure(directory, budget) {
  const gates = {};
  const results = [];
  try {
    for (const name of backends) gates[name] = await startGate(join(directory, "time-" + budget + "-" + name), name, budget, false);
    for (const bytes of sizes) for (const concurrency of [1, 4]) {
      const times = { typescript: [], rust: [] };
      for (let round = -1; round < rounds; round++) {
        const requests = Array.from({ length: concurrency }, (_, i) => call(i + 1, bytes, concurrency));
        for (const name of round % 2 ? backends.toReversed() : backends) {
          const start = performance.now();
          const frames = await gates[name].exchange(requests);
          const elapsed = performance.now() - start;
          for (const frame of frames) {
            const text = frame.result.content[0].text;
            assert.ok(text.includes(marker(frame.id)));
            if (budget === 0 || bytes < 8_000) assert.equal(text.length, bytes);
            else assert.ok(text.length <= 8_000 && text.includes("TRUNCATED"));
          }
          if (round >= 0) times[name].push(elapsed);
        }
      }
      const medianBatchMs = {};
      for (const name of backends) {
        const sorted = times[name].toSorted((a, b) => a - b);
        medianBatchMs[name] = Number(((sorted[rounds / 2 - 1] + sorted[rounds / 2]) / 2).toFixed(3));
      }
      results.push({ budget, bytes, concurrency, medianBatchMs });
    }
  } finally {
    await closeGates(gates);
  }
  return results;
}

const directory = await mkdtemp(join(tmpdir(), "limix-gateway-comparison-"));
try {
  const performanceResults = [];
  const parity = [];
  for (const budget of [0, "default"]) {
    const ts = await verify(join(directory, "check-" + budget + "-ts"), "typescript", budget);
    const rust = await verify(join(directory, "check-" + budget + "-rs"), "rust", budget);
    assert.deepEqual(rust.snapshot, ts.snapshot, "response and spill digests must match");
    parity.push({ budget, matchingFramesAndSpills: ts.snapshot.length, rustFrames: rust.hits });
    if (!values["parity-only"] && !values["verify-only"]) performanceResults.push(...await measure(directory, budget));
  }
  console.log(JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch,
    entry: values.resources ? "packaged" : "source", roundsPerBackend: rounds, defaultBudgetSpills: true,
    parity, performanceResults }, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
