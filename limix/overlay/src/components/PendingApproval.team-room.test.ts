import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot, Message } from "@/state/store";
import type { TeamSetupRequest } from "../../shared/team-setup";

const fixture = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock("@/state/store", async (original) => ({
  ...await original<typeof import("@/state/store")>(),
  useStore: () => ({ dispatch: fixture.dispatch }),
}));
vi.mock("@/lib/use-owner-or-admin", () => ({ useOwnerOrAdmin: () => true }));

import { pendingApprovals, PendingApprovalActions } from "./PendingApproval";

const request = (room?: TeamSetupRequest["room"]): TeamSetupRequest => ({ version: 1, requestId: "setup-1", botId: "chief", threadId: "thread-1", reason: "Help",
  createdAt: 1, requesterRevision: "r", newTeams: [], operations: [{ action: "create", botId: "new-1", fields: { name: "Quill" } }], ...(room ? { room } : {}) });
function message(room?: TeamSetupRequest["room"]): Message {
  return { id: "card-1", at: 1, role: "bot", kind: "options",
    card: { title: "Apply setup for 1 bot?", subtitle: "Why: Help", options: ["Apply setup", "Cancel"], tool: "set_up_team", requestId: "setup-1", teamSetupRequest: request(room) } };
}
type Node = ReactElement<{ children?: ReactNode; onClick?: () => void }>;
const nodes = (value: ReactNode): Node[] => isValidElement(value) ? [value as Node, ...Children.toArray((value as Node).props.children).flatMap(nodes)] : [];
const buttons = (room?: TeamSetupRequest["room"]) => {
  const pending = pendingApprovals([message(room)])[0]!;
  return nodes(PendingApprovalActions({ pending, bot: { id: "chief", name: "Trợ Lý Limix" } as Bot, threadId: "thread-1", onCancelTurn: vi.fn() }))
    .filter((node) => node.type === "button");
};
const label = (node: Node) => Children.toArray(node.props.children).join("");

beforeEach(() => fixture.dispatch.mockReset());

describe("a team setup card that offers a group chat", () => {
  it("lets the reviewer approve the bots with or without the group chat", () => {
    const shown = buttons({ name: "Content team", botIds: ["new-1"] });
    const both = shown.find((node) => /nhóm chat|group chat/.test(label(node)))!;
    const only = shown.find((node) => /Chỉ tạo bot|Bots only/.test(label(node)))!;
    both.props.onClick!();
    only.props.onClick!();
    expect(fixture.dispatch.mock.calls[0]![0]).toMatchObject({ type: "decideRequest", behavior: "allow" });
    expect(fixture.dispatch.mock.calls[0]![0].room).toBeUndefined();
    expect(fixture.dispatch.mock.calls[1]![0]).toMatchObject({ type: "decideRequest", behavior: "allow", room: false });
  });

  it("shows the usual two answers when no group chat is offered", () => {
    expect(buttons().some((node) => /Chỉ tạo bot|Bots only/.test(label(node)))).toBe(false);
  });
});
