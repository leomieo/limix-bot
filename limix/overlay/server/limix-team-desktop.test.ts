import { describe, expect, it } from "vitest";
import { teamLocalVmTarget, perBotLocalVmTarget } from "./container-computer.ts";
import { suggestedTeamDesktop, teamDesktopKey, teamDesktopMembers, teamDesktopResources } from "./limix-team-desktop.ts";

const workspace = { memoryGb: 4, cpus: 2 };
const machine = { memoryGb: 32, cpus: 8, reservedMemoryGb: 6.4, reservedCpus: 1 };

describe("a department's shared desktop", () => {
  it("counts only the department's visible bots that opted in", () => {
    const bots = [
      { id: "a", section: "Content", desktopTeam: true }, { id: "b", section: " content ", desktopTeam: true },
      { id: "c", section: "Content" }, { id: "d", section: "Content", desktopTeam: true, hidden: true }, { id: "e", section: "Ops", desktopTeam: true },
    ];
    expect(teamDesktopMembers(bots, "content").map((bot) => bot.id)).toEqual(["a", "b"]);
    expect(teamDesktopKey({})).toBe("");
  });

  it("grows the suggestion by 2 GB and 1 CPU per bot past the first, within the machine", () => {
    expect(suggestedTeamDesktop(workspace, 1)).toEqual(workspace);
    expect(suggestedTeamDesktop(workspace, 3)).toEqual({ memoryGb: 8, cpus: 4 });
    expect(teamDesktopResources(workspace, Array.from({ length: 3 }, (_, i) => ({ id: String(i) })), machine)).toEqual({ memoryGb: 8, cpus: 4, chosen: "suggested" });
    expect(teamDesktopResources(workspace, Array.from({ length: 20 }, (_, i) => ({ id: String(i) })), machine)).toEqual({ memoryGb: 25, cpus: 7, chosen: "suggested" });
  });

  it("uses the largest size a member set instead of the suggestion", () => {
    const members = [{ id: "a", desktopResources: { memoryGb: 12 } }, { id: "b", desktopResources: { cpus: 6 } }, { id: "c" }];
    expect(teamDesktopResources(workspace, members, machine)).toEqual({ memoryGb: 12, cpus: 6, chosen: "set" });
  });

  it("keeps its identity apart from every bot's own desktop and from other departments", () => {
    const content = teamLocalVmTarget("content");
    expect(content.key).toMatch(/^team:/);
    expect(content.containerName).not.toBe(teamLocalVmTarget("ops").containerName);
    expect(content.key).not.toBe(perBotLocalVmTarget("content").key);
  });
});
