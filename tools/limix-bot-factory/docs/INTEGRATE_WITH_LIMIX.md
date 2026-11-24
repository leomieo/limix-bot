# Integration plan for the actual Limix Bot app

This repository is a scaffold and can be opened in Codex CLI or Claude Code. It is not a fork of Limix Bot. Install the skill into the existing app first, then ask a coding agent to inspect the actual project.

## Work packages

| Stage | Objective | Acceptance criteria |
| --- | --- | --- |
| 0 | Read-only audit of Limix Bot | Repository paths, existing bot create/update APIs and test commands recorded |
| 1 | Import BotSpec and template gallery | Seven cards render without replacing existing Bot management |
| 2 | Add draft and revision support | Draft created with trusted tenant context, no production side effects |
| 3 | Map template capabilities | Existing tools/channels are reused; missing capabilities clearly shown |
| 4 | Add evaluation and approval flow | Real runtime tests plus immutable version-scoped approval |
| 5 | Publish through verified runtime | Server-side auth, safe tool scopes, rollback and event logging |
| 6 | Performance and reliability | Anti-loop, queue/idempotency, model costs and latency baselines |

## Suggested integration interfaces (NOT yet implemented)

```typescript
interface FactoryRuntimeAdapter {
  listAvailableCapabilities(actor: TrustedActor): Promise<Capabilities>;
  validateDraft(actor: TrustedActor, proposal: unknown): Promise<ValidationReport>;
  createDraft(actor: TrustedActor, proposal: ValidatedBotSpec): Promise<BotDraft>;
  runEvaluations(actor: TrustedActor, revisionId: string): Promise<EvaluationReport>;
  requestApproval(actor: TrustedActor, revisionId: string): Promise<ApprovalRequest>;
  publishApproved(actor: TrustedActor, revisionId: string): Promise<BotVersion>;
  pauseOrRollback(actor: TrustedActor, versionId: string): Promise<void>;
}
```

Never instantiate `TrustedActor` from LLM-generated JSON. It must come from the authenticated server context and validated tenant membership.

## App UX outline

- Sidebar or existing bot management page -> `Bot Mau` section.
- Template cards loaded from a validated, versioned catalog.
- User picks template -> requirements wizard -> BotSpec draft -> tool/knowledge/channel readiness view.
- Live testing environment uses safe, isolated permissions and test fixtures.
- Authorized human reviews the exact revision and tool permissions -> publish.
- Bot page shows version, costs, evaluation status, pause and rollback.

## Avoid these design errors

- Creating a parallel bot database and runtime when the app already has one.
- Treating `assets/capabilities.json` as proof that a connector exists.
- Allowing factory skill or MCP to directly grant bot permissions.
- Triggering expensive model calls for deterministic rules.
- Loading unreviewed external GitHub skills straight into production.
- Running the factory's Python process on every user message; it is a creation tool, not the serving runtime.

## Mandatory Hybrid Skills (English Core + Vietnamese Layer)

- Every newly created BotSpec must declare `skills_policy` matching `assets/hybrid-policy.json` exactly; use schema v1.1. Explicitly migrate old 1.0 draft specs.
- For every newly authored/imported bot Skill, keep canonical `SKILL.md` in English and explanatory `references/vi.md` in Vietnamese. The Vietnamese Layer cannot grant tool/tenant privileges, change API IDs, or override English Core.
- Validate via `skill-check` and verify semantic alignment manually. A structural check does not prove safe execution.
- Import only reviewed/pinned third-party skills. Local ZIP export does not approve, install or publish a skill. Keep runtime enforcement outside prompts.
- Return Vietnamese UI and documentation without duplicating the entire English Core in prompts; load language notes on demand.
