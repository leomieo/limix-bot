# Technical leader prompt: integrate Windows Computer Automation into Herionix

You are the technical lead for Herionix, a Windows desktop application. Integrate the attached `windows-computer-automation` skill with the Bot/Teammate system. Every authorized bot must have access to Agent Desktop MCP and Windows-MCP. Two bots must never send input to the same Windows interactive session simultaneously.

1. Inspect the actual repository and existing MCP/tool/skill architecture. Do not guess frameworks, paths or versions. Make a brief plan and change only necessary files; coordinate file ownership if teammates are explicitly requested.
2. Read `SKILL.md`, `references/herionix-integration.md`, `references/security.md`, and `references/routing.md`. Treat `assets/mcp-servers.example.json` as a reference, not an assumed compatible schema.
3. Connect Agent Desktop (`agent-desktop mcp`) and Windows-MCP (`uvx windows-mcp serve` over stdio). Discover `list_tools` dynamically. Verify health, startup/shutdown, timeouts and transport failures. Do not spawn duplicate servers for bots sharing one desktop.
4. Implement ToolRegistry, ComputerControlManager, AuthorizationService, DesktopSessionScheduler, ExecutionLedger and Verifier, or equivalents appropriate to the existing architecture.
5. Prefer Agent Desktop for accessibility references; use Windows-MCP for App/FileSystem/Process and suitable UI fallback. Observe before acting and verify postconditions. Never retry blindly after a side effect.
6. Enforce canonical Windows path allowlists, per-bot permissions, genuine host UI approvals, disabled-by-default PowerShell/Registry, a single desktop writer, per-step idempotency, at most one technical retry and two cycles without progress. Model-supplied approval flags cannot bypass policy.
7. Provide Vietnamese UI under `Tools > Windows Computer Automation`: provider switches/status, allowed folders, bot permissions, current desktop owner/queue, minimal logs and an emergency stop.
8. Test all eight scenarios in `references/herionix-integration.md`, including no GUI session, server crashes, stale references and user mouse input.
9. Preserve Hermes, AionUI Teammate, bot configuration and user data. Do not expose MCP publicly.

Completion requires executable integration, serialized input, permissions enforced by the host, passing unit/integration tests and a concise report of changed files and verification. Distinguish mocked tests from real GUI acceptance. Begin with repository evidence and implement verifiable slices; do not ask for information already present in the code.
