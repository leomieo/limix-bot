import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { launchCloudSendFixture, type CloudSendFixture } from "../scripts/testing/cloud-send-fixture.ts";
import { hostTimeout } from "./testing/host-timeout.ts";

let fx: CloudSendFixture;
beforeAll(async () => { fx = await launchCloudSendFixture({ onePasswordToken: `ops_fake-return-${randomBytes(8).toString("hex")}` }); }, hostTimeout(90_000));
afterAll(async () => { await fx?.close(); });

type Side = CloudSendFixture["local"];
type Row = { id: string; at: number; parentId: string | null; role: "user"; kind: "text"; text: string };
type Thread = { threadId: string; createdAt: number; title: string };
const message = (id: string, at: number, parentId: string | null): Row => ({ id, at, parentId, role: "user", kind: "text", text: id });
const rowIds = async (side: Side, thread: string) => {
  const answer = await side("GET", `/api/cloud-send/chats/ids?thread=${thread}&from=0`);
  expect(answer.status).toBe(200);
  expect(answer.body.more).toBe(false);
  expect(new Set(answer.body.ids).size).toBe(answer.body.ids.length);
  expect(new Set(answer.body.path)).toEqual(new Set(answer.body.ids));
  return answer.body.path as string[];
};

it("returns only the chosen bot, merges history and new chats, and safely repeats after a failed page", async () => {
  const made = await fx.local("POST", "/api/bots", { name: "Return fixture", modelSelection: { instanceId: "claude", model: "claude-sonnet-5" } });
  const bot = made.body.bot as { id: string; threadId: string };
  expect(made.status).toBe(201);
  const start = Date.now();
  const seed = async (side: Side, threadId: string, rows: Row[], task: Thread | null = null, dataDir = fx.desktopDataDir) => {
    const answer = await side("POST", "/api/cloud-send/chats", { v: 1, dataDir,
      conversations: [{ bot: bot.id, threadId, task, rows, leaf: rows.at(-1)!.id, sent: false }] });
    expect(answer.body.accepted).toEqual([threadId]);
  };
  const greeting = await rowIds(fx.local, bot.threadId);
  const shared = message("shared", start, greeting.at(-1) ?? null);
  await seed(fx.local, bot.threadId, [shared]);
  fx.account.state = { ...fx.account.state, machine: { status: "ready", origin: fx.cloudBase, moves: true } };
  await fx.call("cloud-send:move-bots", "local", [bot.id], "chats");
  const onCloud = async () => (await fx.local("GET", "/api/bots")).body.bots.find((candidate: { id: string }) => candidate.id === bot.id)?.movedTo?.state;
  await expect.poll(onCloud, { timeout: 120_000, interval: 250 }).toBe("moved");
  expect(await rowIds(fx.onCloud, bot.threadId)).toEqual([...greeting, "shared"]);
  await seed(fx.local, bot.threadId, [shared, message("local-only", start + 1, "shared")]);
  await seed(fx.onCloud, bot.threadId, [shared, message("cloud-only", start + 2, "shared")]);
  const other = (await fx.onCloud("POST", "/api/bots", { name: "Separate fixture" })).body.bot as { id: string; threadId: string };
  expect(await rowIds(fx.onCloud, other.threadId)).not.toEqual([]);
  const thread = { threadId: "cloud-new-conversation", createdAt: start + 3, title: "From My Cloud" };
  const history = Array.from({ length: 301 }, (_, i) => message(`cloud-${i}`, start + 3 + i, i ? `cloud-${i - 1}` : null));
  const attachment = "return-fixture.png";
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const attachmentRoute = `/api/cloud-send/chats/attachment/${attachment}`;
  const uploaded = await fetch(`${fx.cloudBase}${attachmentRoute}`, { method: "POST", body: bytes,
    headers: { ...fx.edge, authorization: `Bearer ${fx.owner}`, "content-type": "application/octet-stream" } });
  expect(uploaded.status).toBe(201);
  const { dataDir } = (await fx.onCloud("GET", `/api/cloud-send/chats?bot=${bot.id}`)).body;
  history[300]!.text += `\n\n<attached-image path="${join(dataDir, "attachments", attachment)}" name="${attachment}" />`;
  await seed(fx.onCloud, thread.threadId, history, thread, dataDir);

  fx.intercept = (url) => url.includes(`thread=${thread.threadId}&after=`) && !url.includes("&after=0&")
    ? Response.json({}, { status: 503 }) : null;
  await expect(fx.call("cloud-send:bot-bring-back", "local", [bot.id])).rejects.toThrow(/finish downloading/u);
  expect(await onCloud()).toBe("moved");
  expect((await fx.onCloud("GET", "/api/paused")).body.bots).not.toContain(bot.id);
  const firstPage = await rowIds(fx.local, thread.threadId);
  expect(firstPage).toEqual(history.slice(0, 300).map((row) => row.id));

  fx.intercept = null;
  await fx.call("cloud-send:bot-bring-back", "local", [bot.id]);
  expect(await onCloud()).toBeUndefined();
  expect((await fx.onCloud("GET", "/api/paused")).body.bots).toContain(bot.id);
  expect((await fx.onCloud("GET", "/api/paused")).body.bots).not.toContain(other.id);
  expect((await fx.local("GET", "/api/bots")).body.bots.some((candidate: { id: string }) => candidate.id === other.id)).toBe(false);
  expect(await rowIds(fx.local, bot.threadId)).toEqual([...greeting, "shared", "local-only", "cloud-only"]);
  expect(await rowIds(fx.local, thread.threadId)).toEqual(history.map((row) => row.id));
  expect(await rowIds(fx.onCloud, bot.threadId)).toEqual([...greeting, "shared", "cloud-only"]);
  const saved = await fetch(`${fx.desktopBase}${attachmentRoute}`, { headers: { "x-openmausbot-desktop-owner": fx.ownerCapability } });
  expect(saved.status).toBe(200);
  expect(new Uint8Array(await saved.arrayBuffer())).toEqual(bytes);
}, hostTimeout(240_000));
