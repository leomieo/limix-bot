declare const WebAssembly: {
  Module: new (bytes: Uint8Array) => object;
  Instance: new (module: object) => { exports: Record<string, unknown> };
};
import { readFileSync } from "node:fs";
import type { Readable } from "node:stream";
import { limixNativeResource } from "./limix-native-path.ts";
import { MIN_RESULT_BUDGET } from "./mcp-trim.ts";

const MIN_FRAME = 64 * 1024;
const MAX_FRAME = 16 * 1024 * 1024;

interface Decoder {
  memory: { buffer: ArrayBuffer };
  reserve_frame(bytes: number): number;
  inspect_reply(prefixChars: number): number;
}

let decoder: Decoder | null | undefined;

function loadDecoder(): Decoder | null {
  if (decoder !== undefined) return decoder;
  try {
    const bytes = readFileSync(limixNativeResource("limix_tool_gateway.wasm"));
    const module = new WebAssembly.Module(bytes);
    decoder = new WebAssembly.Instance(module).exports as unknown as Decoder;
  } catch {
    decoder = null;
  }
  return decoder;
}

export function inspectLargeToolReply(frame: Buffer, budget: number) {
  if (frame.length < MIN_FRAME || frame.length > MAX_FRAME) return;
  const native = loadDecoder();
  if (!native) return;
  try {
    const input = native.reserve_frame(frame.length);
    new Uint8Array(native.memory.buffer, input, frame.length).set(frame);
    const prefixBudget = budget > 0 ? Math.min(MAX_FRAME, Math.max(MIN_RESULT_BUDGET, Math.floor(budget))) : 0;
    const layout = native.inspect_reply(prefixBudget);
    if (!layout) return;
    const memory = native.memory.buffer;
    const [idAt, idBytes, textAt, textBytes, originalChars, prefixBytes, structured] = new Uint32Array(memory, layout, 7);
    if (structured && originalChars > budget) return;
    const id: unknown = JSON.parse(Buffer.from(memory, idAt, idBytes).toString("utf8"));
    if (typeof id !== "string" && !(typeof id === "number" && Number.isFinite(id))) return;
    const text = Buffer.from(memory, textAt, textBytes);
    return { id, originalChars, text, prefixBytes };
  } catch {
    return;
  }
}

export function readToolResponseFrames(stream: Readable, accept: (frame: Buffer) => void): void {
  let parts: Buffer[] = [];
  let bytes = 0;
  function finish(tail: Buffer) {
    if (bytes === 0) {
      if (tail.length) accept(tail);
    } else {
      parts.push(tail);
      const frame = Buffer.concat(parts, bytes + tail.length);
      parts = [];
      bytes = 0;
      accept(frame);
    }
  }
  stream.on("data", (chunk: Buffer) => {
    let start = 0;
    let cr = chunk.indexOf(13);
    let lf = chunk.indexOf(10);
    while (cr >= 0 || lf >= 0) {
      const end = lf < 0 || (cr >= 0 && cr < lf) ? cr : lf;
      finish(chunk.subarray(start, end));
      start = end + 1;
      if (cr === end) cr = chunk.indexOf(13, start);
      else lf = chunk.indexOf(10, start);
    }
    if (start < chunk.length) {
      parts.push(chunk.subarray(start));
      bytes += chunk.length - start;
    }
  });
  stream.once("end", () => finish(Buffer.alloc(0)));
}
