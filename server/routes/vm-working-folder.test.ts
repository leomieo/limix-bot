import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createVmWorkingFolders } from "../vm-working-folder.ts";
import type { Store } from "../store.ts";
import { createVmWorkingFolderRoutes } from "./vm-working-folder.ts";
import type { RouteContext } from "./table.ts";

it("shares the chosen directory with a room's current bots and revokes only the requested bot", async () => {
  const root = mkdtempSync(join(tmpdir(), "limix-vm-grant-"));
  try {
    const dataDir = join(root, "data");
    const folder = join(root, "project");
    mkdirSync(dataDir);
    mkdirSync(folder);
    const grants = createVmWorkingFolders(dataDir);
    const room = { cwd: folder, memberIds: ["a", "b"] };
    const store = { bot: () => ({ cwd: folder }), group: () => room } as unknown as Store;
    const locks = new Set<string>();
    let desktopsStopped = false;
    const handler = createVmWorkingFolderRoutes({
      enabled: true, dataDir, store, grants, locks, perBot: () => true, busy: (target) => locks.has(target.key),
      stopped: async (targets) => { expect(targets.every(({ key }) => locks.has(key))).toBe(true); return desktopsStopped; },
    });
    const put = async (path: string, body: unknown, trust?: "service") => {
      let answer: { status: number; data: unknown } | undefined;
      await handler({
        path, method: "PUT", req: { headers: { "content-type": "application/json" } },
        auth: { kind: "loopback", trust, scopes: ["admin"] },
        readBody: async () => body,
        json: (_res: unknown, status: number, data: unknown) => { answer = { status, data }; },
      } as unknown as RouteContext);
      return answer;
    };
    const share = { enabled: true, folder };
    const groupPath = "/api/groups/room/vm-working-folder";
    expect(await put(groupPath, share, "service")).toMatchObject({ status: 403 });
    expect(await put(groupPath, { ...share, folder: dataDir })).toMatchObject({ status: 409 });
    expect(await put(groupPath, share)).toMatchObject({ status: 409, data: { code: "stop" } });
    expect(locks.size).toBe(0);
    desktopsStopped = true;
    expect(await put(groupPath, share)).toMatchObject({ status: 200, data: { enabled: true } });
    expect(createVmWorkingFolders(dataDir).forBot("b")?.folder).toBe(grants.forBot("a")?.folder);
    room.memberIds.push("c");
    expect(grants.forBot("c")).toBeUndefined();
    expect(await put(groupPath, share)).toMatchObject({ status: 200, data: { grantedBots: 3 } });
    expect(grants.forBot("c")).toBeDefined();
    expect(await put("/api/bots/a/vm-working-folder", { enabled: false })).toMatchObject({ status: 200, data: { inherited: false } });
    expect(grants.forBot("a")).toBeUndefined();
    expect(grants.forBot("b")).toBeDefined();
    expect(await put(groupPath, { enabled: false })).toMatchObject({ status: 200, data: { enabled: false } });
    expect(grants.forBot("b")).toBeUndefined();
    expect(grants.forBot("c")).toBeUndefined();
    expect(await put("/api/bots/a/vm-working-folder", share)).toMatchObject({ status: 200, data: { enabled: true } });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
