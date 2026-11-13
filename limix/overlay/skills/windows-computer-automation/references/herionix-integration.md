# Integrating into a host app (Windows 10/11)

## 1. Prepare the tools

Install Node.js/npm and Agent Desktop:

```powershell
npm install -g agent-desktop
agent-desktop status
```

Install `uv` and the Python version the Windows-MCP page asks for (its README currently says Python 3.14+). For Windows-MCP, use this command to check the server; note that it keeps running until the client/terminal closes:

```powershell
uvx windows-mcp serve --exclude-tools "PowerShell,Registry" --control-policy balanced
```

Sources:
- https://github.com/vercel-labs/agent-desktop
- https://github.com/CursorTouch/Windows-MCP

## 2. Register the two MCP servers in the backend

See `assets/mcp-servers.example.json`. It is a **sample MCP client config**, not a confirmed config format of the host app. If the host uses another format, move the two `command` + `args` into the app's config. Run the servers in the signed-in Windows user session and use local stdio.

The backend must support startup/healthcheck, `list_tools` discovery, normalized errors, timeouts and shutdown; never spawn a copy of an MCP server per bot when they all drive one session. With several interactive sessions on the machine, tell them apart by the real `desktop_id`.

## 3. Attach the skill

Put the `windows-computer-automation` folder in the **skills directory the host actually loads**. Attach the skill to the bots/teammates allowed to use the computer. If the host has no skill loader yet, it needs a `SKILL.md` parser and the matching entry points — copying the folder alone does not create an MCP connection.

## 4. Suggested components

```text
Bot / Teammate
    |  task + intent
    v
ComputerControlManager (orchestrator)
    |-- policy + host approvals
    |-- desktop mutex + task queue
    |-- state snapshots + idempotency
    |-- progress watchdog + verification
    +-- AgentDesktopAdapter ------> agent-desktop MCP
    +-- WindowsMcpAdapter --------> windows-mcp MCP
```

Modules and responsibilities:
- `ToolRegistry`: discovers the names, schemas and status of both servers' tools.
- `Planner/Router`: picks the provider per task; never recreates side effects when switching providers.
- `AuthorizationService`: user-granted permissions, path allowlist, risk classification and one-time tokens.
- `DesktopSessionScheduler`: input lock per desktop/session and a fair queue.
- `ExecutionLedger`: task ID, step ID, state digest, completion status, idempotency.
- `Verifier`: postconditions after each action; classified error feedback to avoid loops.

## 5. Suggested UI settings

Under `Tools > Windows Computer Automation`: switch each provider on/off; prefer Agent Desktop for UI; show how many bots wait for the desktop; choose the writable folders; admin tools off by default; at most 1 retry; stop after 2 rounds without progress; a Stop/Emergency Release button; an audit log with sensitive data masked.

## 6. Acceptance tests

1. Bot A presses a button in Notepad by ref; Bot B waits and does not touch the keyboard.
2. A UI ref expires → new snapshot; the old ref is not reused and retries are not spammed.
3. The bot lists files read-only; writes a `.txt` in an allowed folder and verifies the file.
4. Deleting a file / running PowerShell / Registry is blocked or asks for the matching host approval.
5. The MCP server stops mid-task → a clear stopped state, no repeated actions.
6. The same `step_id` sent twice → the side effect runs at most once on the host.
7. No progress for two cycles → stop and report why; never clear the context to loop forever.
8. No desktop session/unlocked screen → reported as blocked, never a fake success.

## 7. What this package is

This skill holds the procedure, a testable policy router and a sample MCP config. **It is not a host installer or a ready-made MCP proxy**; the connector, cross-process mutex, approvals and real file verification must be implemented in the host backend.
