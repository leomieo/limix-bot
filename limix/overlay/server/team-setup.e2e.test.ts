import { existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { launchVerificationServer, runControlOmb } from "../scripts/control-omb.ts";
import { removeTempDir } from "./testing/cleanup.ts";

it("the assistant proposes custom and ready-made bots with an optional group chat on one card, and nothing changes until the person decides", async () => {
  const gates = mkdtempSync(join(tmpdir(), "omb-team-setup-gates-"));
  const gate = join(gates, "finish");
  const fixture = await launchVerificationServer({ FAKE_CLAUDE_MODE: "slow", FAKE_CLAUDE_SLOW_FINISH_GATE: gate }, undefined, undefined, undefined, undefined, undefined, ["codex"]);
  const evidence: unknown[] = [{ fixture: fixture.info }];
  const api = async (method: string, path: string, body?: unknown, expected = 200, token?: string, fromApp = true) => {
    const response = await fetch(fixture.info.url + path, { method, headers: { "content-type": "application/json",
      ...(fromApp ? { origin: fixture.info.url } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json() as any;
    evidence.push({ method, path, body, authority: token ? "turn capability" : fromApp ? "app review" : "originless loopback", status: response.status, result });
    expect(response.status, JSON.stringify(result)).toBe(expected); return result;
  };
  const control = async (...args: string[]) => {
    const result = await runControlOmb([...args, "--url", fixture.info.url]) as any;
    evidence.push({ command: args, result }); return result;
  };
  try {
    const catalog = (await api("GET", "/api/instances")).instances;
    const claude = catalog.find((item: any) => item.instanceId === "claude");
    const codex = catalog.find((item: any) => item.instanceId === "codex");
    const selection = (instance: any) => ({ instanceId: instance.instanceId, model: instance.models.default });
    const chief = (await api("POST", "/api/bots", { name: "Clive", title: "Chief of Staff", section: "Operations", modelSelection: selection(claude) }, 201)).bot;
    await api("PATCH", `/api/bots/${chief.id}`, { chiefOfStaff: true, approvalMode: "full" });
    const state = async () => (await api("GET", "/api/bots")).bots;
    const groups = async () => (await control("channels")).channels as any[];
    const initialBotIds = new Set((await state()).map((bot: any) => bot.id));
    const created = async () => (await state()).filter((bot: any) => !initialBotIds.has(bot.id));
    const idle = async () => {
      writeFileSync(gate, "finish");
      // A decision resumes the assistant once, a moment after the card settles: wait for that turn too.
      for (let settled = 0; settled < 2; settled++) {
        await expect.poll(async () => !(await state()).find((bot: any) => bot.id === chief.id).busy, { timeout: 20_000 }).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    };
    const currentDump = async (text: string) => {
      await expect.poll(() => existsSync(fixture.fixtureDumpPath) &&
        JSON.stringify(JSON.parse(readFileSync(fixture.fixtureDumpPath, "utf8")).prompt).includes(text), { timeout: 15_000 }).toBe(true);
      return JSON.parse(readFileSync(fixture.fixtureDumpPath, "utf8"));
    };
    const start = async (text: string) => {
      if (existsSync(gate)) unlinkSync(gate);
      await control("send", "--bot", chief.id, "--task", chief.threadId, "--text", text);
      const dump = await currentDump(text);
      return dump.mcpConfig.mcpServers.agents.env.OMB_COMMS_TOKEN as string;
    };
    const card = async (requestId: string, threadId = chief.threadId) =>
      ((await api("GET", `/api/threads/${threadId}/messages`)).messages as any[]).find((message) => message.card?.requestId === requestId)?.card;

    // Full access would apply a setup at once upstream; here the assistant only proposes and the person decides.
    let token = await start("Clive, I need help writing posts and a researcher. Use a ready-made bot where one fits.");
    const library = await api("GET", "/api/internal/team-library", undefined, 200, token);
    expect(library.botTemplates.map((bot: any) => bot.id)).toContain("research");
    const suggested = await api("GET", `/api/internal/team-library?q=${encodeURIComponent("Gợi ý nhóm bot cho ngành bán lẻ và thương mại điện tử")}`, undefined, 200, token);
    expect(suggested.results[0]).toMatchObject({
      id: "team:industry-retail-ecommerce", source: "builtin", gallery: { kind: "team", id: "industry-retail-ecommerce" },
    });
    const industry = await api("GET", "/api/internal/team-library?details=builtin:industry-customer-care,team:industry-retail-ecommerce", undefined, 200, token);
    expect(industry.templates.map((item: { gallery: { kind: string; id: string } }) => [item.gallery.kind, item.gallery.id])).toEqual([
      ["bot", "industry-customer-care"], ["team", "industry-retail-ecommerce"],
    ]);
    const reviewed = await api("POST", "/api/internal/team-setup-requests", {
      plan: { reason: "Choose the customer-care template", operations: [{ action: "create", key: "care", template: "builtin:industry-customer-care" }] },
    }, 400, token);
    expect(reviewed.error).toContain("Siêu bot CSKH");
    expect(new Set((await state()).map((bot: { id: string }) => bot.id))).toEqual(initialBotIds);
    expect(await api("POST", "/api/internal/create-bot", { name: "Direct", role: "Direct", instructions: "Skip the card." }, 201, token)).toMatchObject({ state: "pending", applied: false });
    await api("POST", "/api/internal/team-setup-requests", { plan: { reason: "x", operations: [{ action: "create", key: "Ghost", template: "no-such-bot" }] } }, 400, token);
    const plan = { reason: "Writing and research help, as asked", operations: [
      { action: "create", key: "Scout", template: "research" },
      { action: "create", key: "Quill", fields: { name: "Quill", title: "Post writer", soul: "Draft short social posts in the person's voice.", modelSelection: selection(codex) } },
    ], room: { name: "Content team" } };
    const proposed = await api("POST", "/api/internal/team-setup-requests", { plan }, 201, token);
    expect(proposed).toMatchObject({ state: "pending", applied: false });
    expect(proposed.detail).toContain('Group chat (the reviewer chooses): "Content team" with @Clive');
    expect(await created()).toEqual([]);
    await idle();
    const pending = await card(proposed.requestId);
    expect(pending.teamSetupRequest.room).toMatchObject({ name: "Content team", botIds: expect.any(Array) });
    expect(pending.answered).toBeUndefined();

    const approved = await api("POST", `/api/threads/${chief.threadId}/respond`, { requestId: proposed.requestId, behavior: "allow" });
    expect(approved).toMatchObject({ outcome: "allowed-once", result: { state: "applied", room: { name: "Content team" } } });
    const bots = await created();
    expect(bots.map((bot: any) => bot.name).sort()).toEqual(["Quill", "Scout"]);
    expect(bots.find((bot: any) => bot.name === "Scout")).toMatchObject({ title: "Researcher", modelSelection: selection(claude) });
    expect(bots.find((bot: any) => bot.name === "Quill")).toMatchObject({ modelSelection: selection(codex) });
    const room = (await groups()).find((group: any) => group.id === approved.result.room.id);
    expect(new Set(room.memberIds)).toEqual(new Set([chief.id, ...bots.map((bot: any) => bot.id)]));
    await idle();

    // The reviewer may take the bots without the group chat.
    token = await start("Add an inbox helper too, with the writer in a chat.");
    const second = await api("POST", "/api/internal/team-setup-requests", { plan: { reason: "Inbox help", operations: [{ action: "create", key: "Inbox", template: "inbox" }],
      room: { name: "Inbox chat", members: ["Inbox", bots.find((bot: any) => bot.name === "Quill").id] } } }, 201, token);
    await idle();
    const roomsBefore = (await groups()).length;
    const botsOnly = await api("POST", `/api/threads/${chief.threadId}/respond`, { requestId: second.requestId, behavior: "allow", room: false });
    expect(botsOnly.result).toMatchObject({ state: "applied", room: null });
    expect((await created()).some((bot: any) => bot.name === "Inbox")).toBe(true);
    expect((await groups()).length).toBe(roomsBefore);
    await idle();

    // Cancelling creates nothing.
    token = await start("Maybe a coder as well?");
    const third = await api("POST", "/api/internal/team-setup-requests", { plan: { reason: "Coding help", operations: [{ action: "create", key: "Dev", template: "coder" }] } }, 201, token);
    await idle();
    expect((await api("POST", `/api/threads/${chief.threadId}/respond`, { requestId: third.requestId, behavior: "deny" })).result.state).toBe("denied");
    expect((await created()).some((bot: any) => bot.name === "Dev")).toBe(false);
    await idle();

    // Deleting a bot waits for a card too.
    token = await start("Delete Inbox.");
    const inbox = (await created()).find((bot: any) => bot.name === "Inbox");
    const deletion = await api("POST", "/api/internal/bot-deletion-requests", { targetBotId: inbox.id, reason: "The person asked" }, 201, token);
    expect(deletion.state).toBe("pending");
    expect((await state()).some((bot: any) => bot.id === inbox.id)).toBe(true);
    await idle();

    // Asked inside a group chat, the proposal card appears in that chat.
    if (existsSync(gate)) unlinkSync(gate);
    await control("send-channel", "--channel", room.id, "--task", room.activeTaskId ?? room.threadId, "--text", "@Clive Add a designer for this chat.");
    const groupDump = await currentDump("Add a designer for this chat.");
    const inRoom = await api("POST", "/api/internal/team-setup-requests", { plan: { reason: "Design help for this chat", operations: [{ action: "create", key: "Pixel", template: "design-critic" }] } },
      201, groupDump.mcpConfig.mcpServers.agents.env.OMB_COMMS_TOKEN);
    expect(inRoom.state).toBe("pending");
    writeFileSync(gate, "finish");
    const roomThread = room.activeTaskId ?? room.threadId;
    await control("wait", "--channel", room.id, "--task", roomThread, "--timeout", "15");
    expect(await card(inRoom.requestId, roomThread)).toMatchObject({ teamSetupRequest: { requestId: inRoom.requestId } });
    expect(readFileSync(fixture.info.logPath, "utf8")).not.toMatch(/ReferenceError|change listener threw/);
  } finally {
    const evidencePath = `${fixture.info.logPath}.team-setup.json`;
    writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    console.info(JSON.stringify({ evidencePath, logPath: fixture.info.logPath }));
    await fixture.close(); await removeTempDir(gates);
  }
}, 180_000);
