# Integrate Factory into the existing Limix Bot repository

**Never assume Limix Bot is an unmodified upstream OpenMausBot checkout.** The user's source repository is authoritative.

## Phase 0: Read-only discovery

- Find root, package manager, web UI, API server, bot model/types, database and migrations, provider registry, channel routes, harness and runtime.
- Search for existing Bot Templates, preset bots, wizard and bot creation endpoints before creating alternatives.
- Inspect ownership of credentials, bot IDs, tenant context and tool policy.
- Record concrete files/functions and a before-change test baseline. Save an adapter map and risks.
- Example upstream paths that MAY be relevant to a related project: `server/contracts.ts`, `server/harness/`, `server/index.ts`, `src/`. These are hints only; verify in local Limix Bot.

## Phase 1: Introduce schema and data

- Adapt `assets/schemas/bot-spec.schema.json` into the project's existing language/type system without duplicating validation in conflicting locations.
- Decide whether existing Bot entity should reference `template_id`, `template_revision`, `bot_spec_version`, or receive a separate draft/revision entity.
- Preserve current Bot data and existing create/edit flows. Ensure migrations are reversible or backed up.
- Determine how the app stores or derives tenant and actor identity; do not trust values from an agent's output.

## Phase 2: Template catalog UI

- Map `assets/ui-catalog.json` to the app's UI component system and existing visual conventions.
- Display categories, 6 cards, preview text, required capabilities and an editable BotSpec summary.
- Add a create-from-template wizard and draft state. Clearly label missing channels, credentials and tools.
- Do not silently install plugins/tools on template selection.

## Phase 3: Runtime adapter

- Implement an adapter at the actual bot-service boundary:
  - `listCapabilities(trustedActorContext)`
  - `validateDraft(trustedActorContext, proposedSpec)`
  - `createDraft(trustedActorContext, validatedSpec)`
  - `runEvaluation(trustedActorContext, draftRevision)`
  - `requestApproval(trustedActorContext, immutableRevision)`
  - `publishApproved(trustedActorContext, approvedRevision)`
  - `pauseOrRollback(trustedActorContext, version)`
- These are **suggested interface methods**, not an existing Limix API.
- Honor the actual repo's app conventions (TypeScript if TS, not a forced Python rewrite).
- The bundled Python core can serve as authoring tooling; port/check policy in the host rather than trusting a local CLI response.

## Phase 4: Deployment gates

- Validate actor, tenant, credential ownership and tool scope on backend.
- Save an immutable revision plus approval metadata before publishing.
- Run real integration tests for every requested channel/tool. A botpack is NOT a runtime-ready bot.
- Limit active bots, resource budgets, worker crash/retry behavior and log retention.
- Canary test and verify rollback before production release.

## Phase 5: Coding agent workflow

- Work in the existing repo, one bounded task at a time. Create no new remote repository unless user asks.
- Keep feature work behind flags when changes risk existing behavior.
- Avoid concurrent Codex and Claude edits to the same worktree.
- Report concrete files changed, commands run, test output, missing secrets/integrations, migrations and rollback.

## Mandatory Hybrid Skills (English Core + Vietnamese Layer)

- Every newly created BotSpec must declare `skills_policy` matching `assets/hybrid-policy.json` exactly; use schema v1.1. Explicitly migrate old 1.0 draft specs.
- For every newly authored/imported bot Skill, keep canonical `SKILL.md` in English and explanatory `references/vi.md` in Vietnamese. The Vietnamese Layer cannot grant tool/tenant privileges, change API IDs, or override English Core.
- Validate via `skill-check` and verify semantic alignment manually. A structural check does not prove safe execution.
- Import only reviewed/pinned third-party skills. Local ZIP export does not approve, install or publish a skill. Keep runtime enforcement outside prompts.
- Return Vietnamese UI and documentation without duplicating the entire English Core in prompts; load language notes on demand.
