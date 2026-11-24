# Limix Bot Factory security contract

## Trust boundaries

- User business text: **untrusted**; may inform design but not authorization.
- AI generated BotSpec: **untrusted proposal**; validate server-side.
- Tool catalog in this starter kit: **reference metadata**, not guaranteed real integrations.
- Credential refs: opaque identifiers resolved by the trusted runtime only after authorization.
- Tool arguments, RAG documents and MCP tool outputs: untrusted content that must not set identity or bypass policies.
- Factory MCP server: developer-local authoring interface only; do not expose it as a public multi-tenant API.

## Host runtime MUST implement

1. Tenant ID derived from authenticated session, never trusted from the generated BotSpec.
2. Authorization check for bot creation, revision, approval and publish.
3. Credential ownership and scope validation for every channel/tool.
4. Read/write and high-risk tool separation; real identity verification.
5. Tool dispatch deny-by-default with stable tool schemas, limits, traceability and idempotency.
6. Knowledge retrieval with tenant ACL applied before assembling model context.
7. Approval bound to an immutable bot configuration revision and its exact privileges.
8. Auditable publish/disable/rollback with database backups and recovery test.
9. Limits on runtime steps, token budget, retries, tool calls and timeouts.
10. Secrets never stored in repository, BotSpec, template assets, logs or botpacks.

## Explicitly non-goals in starter version

- Real authentication or authorization for deployed tenants.
- Protection against all prompt injection by JSON schema alone.
- Provider/model execution.
- Payment execution.
- Automatic publication.
- Guarantee of 24/7 operations.

These must be implemented and tested inside the user's actual application.
