# From business description to reusable Bot Template

## Understand intent

Interpret the user's request as a business workflow, not as a request for unrestricted code execution. Identify:

- Goal and target users; desired outcomes and escalation conditions.
- Existing business systems and authoritative data sources.
- Channels required, whether credentials are already configured, and customer-identity requirements.
- Read-only tools, low-risk writes, high-risk writes and approval steps.
- Languages and tone, model tier, budgets and observability expectations.
- Missing requirements that block integration vs assumptions safe for a draft.

## Select a baseline

List templates with `python scripts/bot_factory.py templates`. Choose the closest template. Use `draft` to generate a baseline; edit the resulting spec JSON to reflect the actual request. Never add a name to the tool/channel registry as if it existed merely because the user requested it. Track capability gaps in the plan instead.

## Customize safely

Keep every bot in `draft` status. `persona.role` describes purpose, not permissions. The `tools` array is a *requested allowlist*, not a grant. Real authorization must occur at the host. `knowledge.collections` names are references only until the app verifies them. Keep actual tokens out of the spec; only `credential_ref` is permitted and it is an opaque reference, not a secret.

## Verify and hand off

1. Validate schema and semantics.
2. Run policy simulation; inspect denied cross-tenant and unapproved sensitive tool tests.
3. Run `plan` to enumerate unbound runtime dependencies.
4. Export botpack. The resulting zip is intentionally unsigned and draft-only.
5. If asked to integrate into Limix Bot, follow `integration-blueprint.md` and verify host contracts.

## Example user request

"Create a Vietnamese shop-support bot that answers product questions, checks customer orders only after verification, and creates tickets. Use Telegram and Web. Never refund automatically."

Suggested implementation:

- Start with `customer-support`; add `orders.lookup` only if customer identity verification is enabled.
- Request Telegram as a channel but leave credential reference unbound until configured.
- Limit bot to knowledge, order lookup and ticket actions; do NOT add refund tool.
- Set explicit retry/step/time/token budgets.
- Use a web and Telegram delivery smoke test only after connecting authenticated runtime adapters.

## Mandatory Hybrid Skills (English Core + Vietnamese Layer)

- Every newly created BotSpec must declare `skills_policy` matching `assets/hybrid-policy.json` exactly; use schema v1.1. Explicitly migrate old 1.0 draft specs.
- For every newly authored/imported bot Skill, keep canonical `SKILL.md` in English and explanatory `references/vi.md` in Vietnamese. The Vietnamese Layer cannot grant tool/tenant privileges, change API IDs, or override English Core.
- Validate via `skill-check` and verify semantic alignment manually. A structural check does not prove safe execution.
- Import only reviewed/pinned third-party skills. Local ZIP export does not approve, install or publish a skill. Keep runtime enforcement outside prompts.
- Return Vietnamese UI and documentation without duplicating the entire English Core in prompts; load language notes on demand.
