import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { CARE_TOOLS, lookupPublicCatalog, prepareCase, triageTicket, validBinding } from "./workflow.mjs";

export { lookupPublicCatalog, prepareCase, triageTicket };

const MAX_INPUT = 32 * 1024;
const PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function callTool(name, args, binding) {
  switch (name) {
    case "care_triage": return triageTicket(args);
    case "care_lookup": return lookupPublicCatalog(args, binding);
    case "care_prepare_case": return prepareCase(args);
    default: throw new TypeError("Unknown tool.");
  }
}

async function write(value) {
  if (!process.stdout.write(JSON.stringify(value) + "\n")) await once(process.stdout, "drain");
}

async function serveMcp(binding) {
  let initialized = false;
  async function handle(frame) {
    let msg;
    try {
      msg = JSON.parse(frame);
    } catch {
      return rpcError(null, -32700, "Invalid JSON.");
    }
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string" ||
        (msg.id !== undefined && typeof msg.id !== "string" && !Number.isSafeInteger(msg.id))) {
      return rpcError(null, -32600, "Invalid request.");
    }
    if (msg.id === undefined) return;
    const { id, method, params } = msg;
    let result;
    if (method === "initialize") {
      if (initialized || typeof params?.protocolVersion !== "string") return rpcError(id, -32602, "Invalid initialization.");
      initialized = true;
      result = {
        protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
        capabilities: { tools: {} }, serverInfo: { name: "industry-care", version: "1.0.0" },
      };
    } else if (method === "ping") {
      result = {};
    } else if (!initialized) {
      return rpcError(id, -32002, "Initialization required.");
    } else if (method === "tools/list") {
      result = { tools: CARE_TOOLS };
    } else if (method === "tools/call") {
      if (!CARE_TOOLS.some((tool) => tool.name === params?.name)) return rpcError(id, -32602, "Unknown tool.");
      try {
        const output = await callTool(params.name, params.arguments, binding);
        result = { content: [{ type: "text", text: JSON.stringify(output) }] };
      } catch {
        result = { content: [{ type: "text", text: "Invalid tool arguments." }], isError: true };
      }
    } else {
      return rpcError(id, -32601, "Unknown method.");
    }
    return { jsonrpc: "2.0", id, result };
  }

  let pending = Buffer.alloc(0);
  let oversized = false;
  for await (const chunk of process.stdin) {
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start);
      const part = chunk.subarray(start, newline < 0 ? chunk.length : newline);
      oversized ||= pending.length + part.length > MAX_INPUT;
      if (!oversized) pending = Buffer.concat([pending, part]);
      if (newline < 0) break;
      const response = oversized ? rpcError(null, -32600, "Frame too large.") : await handle(pending.toString("utf8"));
      if (response) await write(response);
      pending = Buffer.alloc(0);
      oversized = false;
      start = newline + 1;
    }
  }
}

async function readInput() {
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > MAX_INPUT) throw new Error("Input too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function run() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2), allowPositionals: true,
    options: { scope: { type: "string" }, "catalog-dir": { type: "string" } },
  });
  if (positionals.length !== 1) throw new Error("Invalid command.");
  const binding = { scope: values.scope, catalogDir: values["catalog-dir"] };
  if (Object.keys(values).length && !validBinding(binding)) throw new Error("Invalid binding.");
  const [command] = positionals;
  if (command === "mcp") return serveMcp(binding);
  const cliTools = new Map([["triage", "care_triage"], ["lookup", "care_lookup"], ["prepare", "care_prepare_case"]]);
  const tool = cliTools.get(command);
  if (!tool) throw new Error("Unknown command.");
  await write(await callTool(tool, await readInput(), binding));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(() => {
    process.stderr.write("Expected triage, lookup, prepare, or mcp with valid input and optional --scope ID --catalog-dir ABSOLUTE_PATH.\n");
    process.exitCode = 1;
  });
}
