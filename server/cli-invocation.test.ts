import { describe, expect, it } from "vitest";

import { cliCommand, cliPrefix } from "./cli-invocation.ts";

describe("cliPrefix", () => {
  it("prints commands the way the CLI was started", () => {
    expect(cliPrefix({}, "/home/me/.npm/_npx/1a2b/node_modules/openmausbot/dist-server/limixbot.js")).toBe("npx limixbot");
    expect(cliPrefix({ npm_command: "exec" }, "/repo/node_modules/vitest/vitest.mjs"), "another tool run by npx").toBe("limixbot");
    expect(cliPrefix({ npm_lifecycle_event: "omb" }, "/repo/server/limixbot.ts")).toBe("pnpm omb");
    expect(cliPrefix({ OMB_CLI_PREFIX: "docker compose exec omb openmausbot" }, "/app/dist-server/limixbot.js")).toBe("docker compose exec omb openmausbot");
    expect(cliPrefix({}, "/usr/lib/node_modules/openmausbot/dist-server/limixbot.js")).toBe("limixbot");
    expect(cliCommand("pair", {}, "C:\\Users\\me\\AppData\\Local\\npm-cache\\_npx\\9\\node_modules\\openmausbot\\x.js")).toBe("npx limixbot pair");
  });
});
