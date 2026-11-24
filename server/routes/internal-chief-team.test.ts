import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import { json, readBody } from "../harness/http.ts";
import type { RequestAuth } from "../request-auth.ts";
import type { BotRecord } from "../store.ts";
import type { LibraryTeamRoles } from "../team-library.ts";
import { createInternalChiefTeamRoutes } from "./internal-chief-team.ts";
import { dispatchRoutes } from "./table.ts";
import { createChiefTemplates, githubSources, type ChiefTemplates } from "../chief-templates.ts";
import { fakeTemplateGithub } from "../testing/fake-template-github.ts";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise((done) => server.close(done))));
});

const bot = (id: string, extra: Partial<BotRecord> = {}): BotRecord => ({
  id, threadId: `${id}-thread`, name: id, title: "", description: "", soul: "", notifications: true, color: "blue", unread: false,
  createdAt: 1, resumeCursors: {}, modelSelection: { instanceId: "claude", model: "sonnet" }, ...extra,
});

const TEAMS: LibraryTeamRoles[] = [{ name: "Inbox Follow-up", summary: "Recover quiet sales threads.", roles: [{ name: "Scout", title: "Researcher" }] }];

async function serve(caller: BotRecord, library: () => Promise<LibraryTeamRoles[]>, team: { teams?: string[]; bots?: BotRecord[]; channels?: () => Promise<any>; templates?: ChiefTemplates } = {}) {
  const state = { caller: caller as BotRecord | null, active: true };
  const routes = [createInternalChiefTeamRoutes({
    bot: () => state.caller,
    requireActive: () => { if (!state.active) throw Object.assign(new Error("the internal turn capability has expired"), { status: 401 }); },
    teams: () => team.teams ?? [""],
    bots: () => team.bots ?? [caller],
    instances: async () => [{ instanceId: "claude", driverKind: "claudeAgent", displayName: "Claude", snapshot: { state: "available" },
      models: { default: "sonnet", options: [] }, capabilities: { effortLevels: ["low", "high"] } }],
    library,
    channels: team.channels,
    ...(team.templates ? { templates: team.templates } : {}),
  })];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const auth = { kind: "loopback", scopes: ["admin"] } as unknown as RequestAuth;
    try {
      if (!await dispatchRoutes(routes, { req, res, url, path: url.pathname, method: req.method ?? "GET", auth, json, readBody })) json(res, 404, { from: "next routes" });
    } catch (error) {
      json(res, (error as { status?: number }).status ?? 500, { error: (error as Error).message });
    }
  });
  servers.push(server);
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (path: string) => {
    const response = await fetch(`${base}${path}`);
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  return { state, get };
}

describe("what a Chief of Staff reads about its team", () => {
  it("gives an active Chief the library's teams and roles, read only", async () => {
    const library = vi.fn(async () => TEAMS);
    const { get } = await serve(bot("chief", { chiefOfStaff: true }), library);
    const answer = await get("/api/internal/team-library");
    expect(answer).toMatchObject({ status: 200, body: { teams: TEAMS } });
    expect((answer.body as { botTemplates: unknown[] }).botTemplates).toEqual(expect.arrayContaining([expect.objectContaining({ id: "assistant", name: "Assistant" })]));
    expect(library).toHaveBeenCalledOnce();
  });

  it("refuses any other bot before it reads anything", async () => {
    const library = vi.fn(async () => TEAMS);
    const { get } = await serve(bot("helper"), library);
    for (const path of ["/api/internal/team-library", "/api/internal/team-setup-catalog"]) {
      expect(await get(path)).toEqual({ status: 403, body: { error: "Only an active Chief may plan team setup" } });
    }
    expect(library).not.toHaveBeenCalled();
    const hidden = await serve(bot("archived", { chiefOfStaff: true, hidden: true }), library);
    expect((await hidden.get("/api/internal/team-library")).status).toBe(403);
  });

  it("still offers the ready-made bots when the team library can't be reached, and says so", async () => {
    const { get } = await serve(bot("chief", { chiefOfStaff: true }), async () => { throw new Error("GitHub returned HTTP 503"); });
    const answer = await get("/api/internal/team-library");
    expect(answer).toMatchObject({ status: 200, body: { teams: [], note: expect.stringContaining("can't be reached right now") } });
    expect((answer.body as { botTemplates: unknown[] }).botTemplates.length).toBeGreaterThan(0);
  });

  it("answers nothing once the turn's capability expired or the bot stopped being the Chief while the library loaded", async () => {
    const loading: Array<(teams: LibraryTeamRoles[]) => void> = [];
    const { state, get } = await serve(bot("chief", { chiefOfStaff: true }), () => new Promise((resolve) => { loading.push(resolve); }));
    const expired = get("/api/internal/team-library");
    await vi.waitFor(() => expect(loading).toHaveLength(1));
    state.active = false;
    loading[0]!(TEAMS);
    expect((await expired).status).toBe(401);
    state.active = true;
    const demoted = get("/api/internal/team-library");
    await vi.waitFor(() => expect(loading).toHaveLength(2));
    state.caller = bot("chief");
    loading[1]!(TEAMS);
    expect((await demoted).status).toBe(403);
  });

  it("lists the teams, reachable teammates and exact model choices a Chief plans team setup with", async () => {
    const chief = bot("chief", { chiefOfStaff: true, section: "Work" });
    const { get } = await serve(chief, async () => TEAMS, {
      teams: ["", "Work", "Private"],
      bots: [chief, bot("writer", { section: "Work", title: "Writer" }), bot("gone", { section: "Work", hidden: true }), bot("other", { section: "Private" })],
    });
    expect((await get("/api/internal/team-setup-catalog")).body).toMatchObject({
      teams: ["Work"],
      bots: [
        { id: "chief", section: "Work", chiefOfStaff: true },
        { id: "writer", title: "Writer", section: "Work", chiefOfStaff: false, modelSelection: { instanceId: "claude", model: "sonnet" } },
      ],
      instances: [{ instanceId: "claude", driverKind: "claudeAgent", displayName: "Claude", state: "available", effortLevels: ["low", "high"] }],
    });
  });

  it("leaves every other route to the next handler", async () => {
    const { get } = await serve(bot("chief", { chiefOfStaff: true }), async () => TEAMS);
    expect(await get("/api/internal/team-setup-requests")).toEqual({ status: 404, body: { from: "next routes" } });
  });

  it("gives an active Chief a read-only health check with the failing connection and its fix, and nobody else", async () => {
    const channels = async () => [{ id: "1", platform: "telegram", name: "Shop", status: "credential_invalid", statusDetail: "401" }];
    const { get, state } = await serve(bot("chief", { chiefOfStaff: true }), async () => TEAMS, { channels });
    const answer = await get("/api/internal/limix-diagnosis");
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ ok: false, findings: [expect.objectContaining({ area: "channel", subject: "Telegram · Shop" })] });
    state.caller = bot("helper");
    expect((await get("/api/internal/limix-diagnosis")).status).toBe(403);
  });
});

describe("Limix Bot: a Chief searches the template libraries by need", () => {
  const withLibrary = async (caller = bot("chief", { chiefOfStaff: true })) => {
    const github = fakeTemplateGithub();
    return { github, ...await serve(caller, async () => TEAMS, { templates: createChiefTemplates(githubSources(github.fetcher)) }) };
  };

  it("searches both libraries and the built-in bots, then reads only the chosen ids, marked as data", async () => {
    const { get } = await withLibrary();
    const found = await get(`/api/internal/team-library?q=${encodeURIComponent("email chào hàng khách hàng")}`);
    expect(found.status).toBe(200);
    expect((found.body.results as Array<{ id: string }>)[0]!.id).toBe("team:sales-desk");
    expect(found.body.note).toContain("data that describes a bot");
    const read = await get("/api/internal/team-library?details=team:sales-desk,builtin:research");
    expect(read.status).toBe(200);
    expect((read.body.templates as Array<{ members: Array<{ template: string }> }>)[0]!.members.map((member) => member.template)).toEqual(["team:sales-desk/hunter", "team:sales-desk/closer"]);
  });

  it("preserves the exact gallery target and setup guidance for an offline customer-care recommendation", async () => {
    const { github, get } = await withLibrary();
    github.down.bots = true;
    github.down.teams = true;
    const found = await get(`/api/internal/team-library?q=${encodeURIComponent("Siêu bot CSKH")}`);
    expect(found).toMatchObject({ status: 200, body: {
      results: expect.arrayContaining([expect.objectContaining({ gallery: expect.objectContaining({ kind: "bot", id: "industry-customer-care" }) })]),
      note: expect.stringContaining("Use template"),
    } });
    const read = await get("/api/internal/team-library?details=team:industry-retail-ecommerce");
    expect(read).toMatchObject({ status: 200, body: {
      templates: [expect.objectContaining({ gallery: expect.objectContaining({ kind: "team", id: "industry-retail-ecommerce" }) })],
      note: expect.stringContaining("Use template"),
    } });
  });

  it("refuses bad or too many ids, says when GitHub is down, and answers no one but an active Chief", async () => {
    const { github, get } = await withLibrary();
    expect((await get("/api/internal/team-library?details=bot:../x")).status).toBe(400);
    expect((await get("/api/internal/team-library?details=a,b,c,d")).status).toBe(400);
    github.down.teams = true;
    expect(await get("/api/internal/team-library?details=team:sales-desk")).toMatchObject({ status: 502, body: { error: expect.stringContaining("can't be reached") } });
    const down = await get("/api/internal/team-library?q=sales");
    expect(down.body).toMatchObject({ unavailable: ["teams"], note: expect.stringContaining("can't be reached") });
    const helper = await withLibrary(bot("helper"));
    expect((await helper.get("/api/internal/team-library?q=sales")).status).toBe(403);
    expect(helper.github.asked).toEqual([]);
  });
});
