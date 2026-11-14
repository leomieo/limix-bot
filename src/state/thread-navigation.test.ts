import { afterEach, describe, expect, it, vi } from "vitest";
import { setTeamChats } from "./team-chats";
import { botOpensTo, markedThread, openBotRow, openRoomThread, openThread } from "./thread-navigation";

type Task = { threadId: string; activity?: string; unread?: boolean; busy?: boolean; botApi?: true; routineRunId?: string; archivedAt?: number; createdAt?: number; updatedAt?: number };
const chief = (tasks: Task[], threadId = "main", mainThreadId = "main") => ({ id: "cos", threadId, mainThreadId, tasks: [{ threadId: "main", createdAt: 1 }, ...tasks] });
const opened = (bot: ReturnType<typeof chief>, threadsShown: boolean, onScreen = false) => {
  const dispatch = vi.fn();
  openBotRow(dispatch, bot, threadsShown, onScreen);
  return dispatch.mock.calls.map(([action]) => action);
};

afterEach(() => setTeamChats(null));

describe("what a bot's row or tile is marked for", () => {
  it("is what waits on the person first, then an unread reply, then work under way", () => {
    const working = { threadId: "work", busy: true }, unread = { threadId: "reply", unread: true }, waiting = { threadId: "ask", activity: "waiting-on-you" };
    expect(markedThread(chief([working]), false)).toBe("work");
    expect(markedThread(chief([working, unread]), false)).toBe("reply");
    expect(markedThread(chief([working, unread, waiting]), false)).toBe("ask");
  });

  it("is the newest of equals, unless the thread the bot opens to is one of them", () => {
    const older = { threadId: "older", unread: true, updatedAt: 5 }, newer = { threadId: "newer", unread: true, updatedAt: 9 };
    expect(markedThread(chief([older, newer]), false)).toBe("newer");
    expect(markedThread({ ...chief([older, newer]), tasks: [{ threadId: "main", unread: true, createdAt: 1 }, older, newer] }, false)).toBe("main");
  });

  it("is never a routine's run, nor an archived thread unless it waits on the person, as the row's own dot reads them", () => {
    expect(markedThread(chief([{ threadId: "run", busy: true, routineRunId: "r" }]), false)).toBeNull();
    expect(markedThread(chief([{ threadId: "put-away", unread: true, archivedAt: 1 }]), false)).toBeNull();
    expect(markedThread(chief([{ threadId: "put-away", activity: "waiting-on-you", archivedAt: 0 }]), false)).toBe("put-away");
  });

  it("is nothing on a quiet bot", () => {
    expect(markedThread(chief([{ threadId: "quiet" }]), false)).toBeNull();
    expect(markedThread({ id: "x", threadId: "t" } as unknown as ReturnType<typeof chief>, false)).toBeNull();
  });
});

describe("a click on a bot's row or tile", () => {
  const work = { threadId: "work", unread: true };

  it("lands on the thread the dot is about, by the switch alone so the thread left behind stays unread", () => {
    expect(opened(chief([work]), false)).toEqual([{ type: "switchTask", botId: "cos", threadId: "work" }]);
  });

  it("selects first while threads are shown, as every thread opener does there", () => {
    expect(opened(chief([work]), true)).toEqual([{ type: "select", id: "cos" }, { type: "switchTask", botId: "cos", threadId: "work" }]);
  });

  it("lands on a thread a teammate's work is running in, and a second click comes back to the main chat", () => {
    const running = { threadId: "work", busy: true };
    expect(opened(chief([running]), false)).toEqual([{ type: "switchTask", botId: "cos", threadId: "work" }]);
    expect(opened(chief([running], "work"), false, true)).toEqual([{ type: "switchTask", botId: "cos", threadId: "main" }]);
  });

  it("opens the bot as ever when nothing is marked, or when the main chat itself is what is marked", () => {
    expect(opened(chief([{ threadId: "quiet" }]), false)).toEqual([{ type: "select", id: "cos" }]);
    expect(opened({ ...chief([work]), tasks: [{ threadId: "main", unread: true, createdAt: 1 }, { threadId: "work" }] }, false)).toEqual([{ type: "select", id: "cos" }]);
  });

  it("leaves a team's Cloud alone: there a bot's row is the person's own conversation", () => {
    setTeamChats({ teamId: "acme", member: true, opened: [] });
    const bot = { ...chief([work]), tasks: [{ threadId: "mine", private: true, createdAt: 3 }, work] };
    expect(opened(bot as ReturnType<typeof chief>, false)).toEqual([{ type: "switchTask", botId: "cos", threadId: "mine" }]);
  });
});

describe("a hand-off's chip for work in a room", () => {
  const room = { id: "room", threadId: "room-now", tasks: [{ threadId: "room-now" }, { threadId: "room-older" }] };
  const clicked = (comm: { groupId: string; threadId?: string }) => {
    const dispatch = vi.fn();
    openRoomThread(dispatch, comm, [room]);
    return dispatch.mock.calls.map(([action]) => action);
  };

  it("lands on the thread it names, not whichever the room is on", () => {
    expect(clicked({ groupId: "room", threadId: "room-older" })).toEqual([{ type: "select", id: "room" }, { type: "switchGroupTask", groupId: "room", threadId: "room-older" }]);
  });

  it("opens the room when it names no thread, or one the room no longer has", () => {
    expect(clicked({ groupId: "room" })).toEqual([{ type: "select", id: "room" }]);
    expect(clicked({ groupId: "room", threadId: "deleted" })).toEqual([{ type: "select", id: "room" }]);
  });
});


describe("desktop chats and channel conversations", () => {
  const external: Task = { threadId: "zalo-customer", botApi: true, unread: true, busy: true, activity: "waiting-on-you", updatedAt: 100 };

  it.each([false, true])("keeps channel activity from hijacking the bot row with threadsShown=%s", (threadsShown) => {
    const bot = chief([external]);
    expect(markedThread(bot, threadsShown)).toBeNull();
    expect(opened(bot, threadsShown)).toEqual([{ type: "select", id: "cos" }]);
  });

  it.each([false, true])("returns from a remembered channel conversation to the desktop main chat with threadsShown=%s", (threadsShown) => {
    const bot = chief([external], external.threadId);
    expect(botOpensTo(bot, threadsShown)).toBe("main");
    expect(opened(bot, threadsShown)).toEqual([
      ...(threadsShown ? [{ type: "select", id: "cos" }] : []),
      { type: "switchTask", botId: "cos", threadId: "main" },
    ]);
  });

  it("chooses a local conversation when the saved main chat is missing or is itself a channel thread", () => {
    const bot = { ...chief([], external.threadId, external.threadId), tasks: [external, { threadId: "routine", routineRunId: "r" }, { threadId: "archived", archivedAt: 1 }, { threadId: "configure" }] };
    expect(botOpensTo(bot, false)).toBe("configure");
    expect(botOpensTo({ ...bot, mainThreadId: "gone" }, true)).toBe("configure");
  });

  it("creates a desktop conversation if only channel conversations remain", () => {
    const bot = { ...chief([], external.threadId), tasks: [external] };
    expect(opened(bot, false)).toEqual([{ type: "newTask", botId: "cos" }]);
  });

  it("still opens the exact channel conversation when explicitly inspecting it", () => {
    const bot = { ...chief([external]), name: "Support" };
    const dispatch = vi.fn();
    expect(openThread(dispatch, { botId: bot.id, threadId: external.threadId }, { bots: [bot], groups: [] }, false)).toBe(true);
    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: "switchTask", botId: bot.id, threadId: external.threadId },
      { type: "revealThread", threadId: external.threadId },
    ]);
  });
});
