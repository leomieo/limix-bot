# Prompt for Codex CLI or Claude Code (single-agent implementation)

You are working inside the EXISTING Limix Bot repository. The user wants a "Bot Mau" gallery and a natural-language-to-BotSpec creation workflow, not a second bot platform.

The installed `limix-bot-factory` skill provides sample templates, a JSON schema, static draft validation, dry-run policy simulation, a local CLI and an optional MCP server. It does NOT include a real Limix runtime adapter.

1. Inspect the current repository (framework, existing bot flows, auth/tenant system, tools, channels, database, frontend and tests). Cite exact local files in an architecture map. Do not infer paths from upstream OpenMausBot without checking.
2. Run the skill's bundled tests; create a real gap analysis mapping every requested Factory capability to an existing module or missing component.
3. Build a Bot Template gallery using the existing design system; adapt the seven provided Vietnamese cards and add a template preview.
4. Add create-from-template as a DRAFT-only flow. Convert free-form descriptions into a BotSpec proposal, then validate it deterministically in the backend. Do not let the model directly grant tool/tenant/credential privileges.
5. Reuse existing bot registration, worker runtime and tools wherever feasible. Add an authenticated adapter and immutable revision tracking with minimal schema changes.
6. Resolve template tool names against ACTUAL registered runtime tools. Show missing or unavailable connectors; never silently fabricate capabilities or claim Telegram/Zalo integration without testing.
7. Separate policy simulation (provided) from actual execution policy (must be implemented and tested server-side).
8. Add evaluation, approval and publication flow with authorization, version binding, rollback, anti-loop budgets, logs, safe deployment, and accurate readiness labels.
9. Use feature flags, safe migrations, regression tests and a test baseline. Keep existing Limix Bot features and UI working. Do not alter production resources or add billable providers without permission.
10. Report in Vietnamese: current code references, changes, tests executed, remaining blockers and exact next steps. Continue autonomously on safe tasks; stop for destructive or production-impacting changes.

Prioritize stable and secure configuration-driven bot creation over unrestricted auto-generated code. Do not use subagents unless the user explicitly chooses them.

## Mandatory Hybrid Skills (English Core + Vietnamese Layer)

- Every newly created BotSpec must declare `skills_policy` matching `assets/hybrid-policy.json` exactly; use schema v1.1. Explicitly migrate old 1.0 draft specs.
- For every newly authored/imported bot Skill, keep canonical `SKILL.md` in English and explanatory `references/vi.md` in Vietnamese. The Vietnamese Layer cannot grant tool/tenant privileges, change API IDs, or override English Core.
- Validate via `skill-check` and verify semantic alignment manually. A structural check does not prove safe execution.
- Import only reviewed/pinned third-party skills. Local ZIP export does not approve, install or publish a skill. Keep runtime enforcement outside prompts.
- Return Vietnamese UI and documentation without duplicating the entire English Core in prompts; load language notes on demand.
