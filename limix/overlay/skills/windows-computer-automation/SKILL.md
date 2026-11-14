---
name: windows-computer-automation
description: "Coordinate an AI agent or bot that controls Windows through Agent Desktop and Windows-MCP. Use it to read the screen, work windows, type, drive a browser, and manage apps, files or processes; pick the right tool, respect permissions, keep bots from fighting over the mouse, verify results and never repeat an action blindly. Also helps design or fix the integration of these two MCP servers into a multi-agent AI app. (vi: điều khiển máy tính, tự động hóa Windows, thao tác cửa sổ, chụp màn hình)"
---

# Windows Computer Automation

## Goal

Use **Agent Desktop** for Windows UI elements found through the accessibility tree; use **Windows-MCP** for system tools, the filesystem, apps, processes, and as a UI fallback where it fits. This skill is orchestration guidance: it **never installs an MCP server or grants permissions on the machine by itself**. Act only when the host app is actually connected to these MCP servers and the tools are permitted.

## Required procedure

1. **Define the task and its limits:** confirm the app/window, inputs and outputs, file paths, and whether the final action is allowed. Tell read-only work apart from changes to the system.
2. **Discover the real capabilities:** call `list_tools` on both MCP servers; never assume a tool exists because a document names it. Check the desktop state, the OS, the signed-in session and permissions. If a connector is missing, stop and say exactly which; never pretend an action happened.
3. **Check the risk:** read [references/security.md](references/security.md). Deleting/overwriting, running commands, editing the Registry, sending content out, payments, permission changes or killing processes are decided by the host's policy. The model **never approves itself**. The host must block the action before the tool is called.
4. **One desktop, one writer:** a `desktop_id` has **one agent holding write/input rights** at a time; the lock lives in the host backend, not only in the prompt. Several agents may plan or read when reading does not interfere; writes go through a queue.
5. **Observe before acting:** prefer the accessibility tree, refs and window IDs; avoid coordinates while a stable identifier exists. Pick the provider with the table below and [references/routing.md](references/routing.md).
6. **Do the minimum:** run only the step that is needed. Never call two input tools in parallel. Use the dedupe key `task_id + step_id + target + desired_effect` issued by the backend.
7. **Verify after acting:** read the element/state/file or matching result again and confirm the postcondition. `tool returned success` does not mean the work is done.
8. **Bounded recovery:** on `STALE_REF`/`AMBIGUOUS_TARGET`, refresh the snapshot and locate again. Retry only when upstream says it is safe or the postcondition proves no side effect happened. Stop after at most **1 technical retry** per step, or **2 cycles without progress**; never loop forever, never `microcompact` to hide an error.
9. **Report:** answer briefly in the user's language: what was done and verified, files created (if any), steps not finished, approvals needed, errors and non-sensitive evidence. Never log screenshots or clipboard content that holds secrets.

## Choosing the tool

| Situation | Prefer | Fallback / condition |
|---|---|---|
| Read/click/type on UI with an identifying ref | Agent Desktop: `desktop_snapshot`, `desktop_click`, `desktop_type`... | Windows-MCP `Snapshot` + `Click`/`Type` after locating again |
| UI without accessibility, or coordinate control | Windows-MCP `Snapshot` / `Screenshot`, `Click`, `Type` | Agent Desktop `--headed` only when needed and allowed |
| Launch or switch app windows | Windows-MCP `App` | Agent Desktop `desktop_launch` / window tools if present |
| Read or write files in allowed folders | Windows-MCP `FileSystem` | Never replace with UI clicks when a trusted API/file tool exists |
| Inspect processes | Windows-MCP `Process` (list only) | Terminate needs confirmation from the host |
| PowerShell / Registry | **Not enabled by default** | Only enabled on purpose in a controlled environment, through host approval |
| Web pages that need the DOM | Windows-MCP `Snapshot` (`use_dom` if the version supports it) | For complex web flows, consider a dedicated browser automation |

**Never switch providers to retry blindly:** after a failed action that has side effects, observe and verify the state before choosing the next step.

## Token-saving loop

- Keep `window_id`, `snapshot_id`, the goal and a short state summary; **invalidate** old refs after every UI change.
- Do not send a full-screen image at every step; use the compact tree, a small region capture or a per-app snapshot.
- Continue only on a new `progress marker` (state changed, a file appeared, a button changed state, the page moved on); after two rounds without progress, stop and report.
- If two agents ask for control at once, only one acts; the other waits or does work that does not touch the desktop.

## Connecting and testing

- See [references/herionix-integration.md](references/herionix-integration.md) to install and connect the two MCP servers over stdio.
- Use [assets/mcp-servers.example.json](assets/mcp-servers.example.json) as an illustrative config, **not as an official host config file**.
- `scripts/policy_engine.py` is an example router/guard **with no power to execute anything on the OS**; the backend must do the real policy checks, locks and approvals. Examples and tests: [references/scenarios.md](references/scenarios.md).

## Without permission to control the machine

Present the plan, config commands or code; say clearly that nothing was executed or verified on a real Windows machine. Never claim an integration into the machine or the host app without access to the app's source and runtime.
