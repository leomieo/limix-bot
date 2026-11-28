import { describe, expect, it } from "vitest";
import { decodeProcessSample, tryRustProcessSample } from "./native-process-sampler.ts";

describe("native process sampler protocol", () => {
  it("distinguishes an idle tree from unreadable CPU or network counters", () => {
    for (const cpuMs of [0, 31.25, null]) {
      for (const connections of [0, 2, null]) {
        expect(decodeProcessSample(JSON.stringify({ cpuMs, connections }))).toEqual({ cpuMs, connections });
      }
    }
  });

  it("rejects a truncated record, missing fields and invalid counters", () => {
    for (const stdout of ["", "null", "[]", "{}", '{"cpuMs":0}', '{"cpuMs":"0","connections":0}',
      '{"cpuMs":-1,"connections":0}', '{"cpuMs":1e999,"connections":1}', '{"cpuMs":0,"connections":0.5}',
      '{"cpuMs":0,"connections":-1}', '{"cpuMs":0,"connections":null}\n{}']) {
      expect(decodeProcessSample(stdout)).toBeNull();
    }
  });

  it("returns unknown for inputs outside the native protocol", async () => {
    for (const [pid, since] of [[0], [2 ** 32], [42, -1], [42, Infinity]]) {
      expect(await tryRustProcessSample(pid, since)).toEqual({ cpuMs: null, connections: null });
    }
  });
});
