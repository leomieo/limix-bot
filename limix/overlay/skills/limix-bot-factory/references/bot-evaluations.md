# Evaluation scope

The bundled `evaluate` command only checks **static BotSpec and local policy simulation**. It cannot measure model quality, live RAG accuracy, provider availability, or production isolation.

## Starter checks

- Block a tool when actor tenant differs from the declared bot tenant.
- Block shell access, which is absent from the approved tool catalog.
- Require verified customer identity before any private order lookup.
- Require human approval for an allowlisted sensitive write.
- Ensure arbitrary code execution and autonomous deployment are disabled.

## Required runtime evaluation suite (implement in Limix Bot)

1. Tenant authorization with real authenticated server context and cross-tenant API attempts.
2. RAG retrieval: permission filtering, correct citations, recall/precision and stale documents.
3. Tool integration: read/write roles, credential ownership, idempotency and retry boundaries.
4. Safety: prompt injection and malicious tool content, output leakage and unsafe actions.
5. Functional: Vietnamese conversation examples and escalation to staff.
6. Reliability: crash recovery, webhook duplicate delivery and worker restarts.
7. Performance: p50/p95 latency, context budget, cost, cache hit rate and concurrency.
8. Release: immutable configuration, human approvals, disabled/pause/rollback behaviors.

Do not label the Factory as production-ready based on the starter checks alone.
