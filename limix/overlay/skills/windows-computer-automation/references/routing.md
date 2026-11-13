# Routing and loop prevention

## Sources of truth

- Agent Desktop: https://github.com/vercel-labs/agent-desktop — MCP tools are prefixed `desktop_` (`desktop_snapshot`, `desktop_click`...). A `ref_id` carries a snapshot ID and becomes invalid when the UI changes. Tools can return `STALE_REF`, `AMBIGUOUS_TARGET`; read the JSON `error.disposition.retry` before retrying.
- Windows-MCP: https://github.com/CursorTouch/Windows-MCP — tools `Snapshot`, `Screenshot`, `Click`, `Type`, `App`, `FileSystem`, `Process`, `PowerShell`, `Registry`, `ControlStatus`, etc. Check what is currently available with `list_tools`.

## Per-step algorithm

1. Check permissions first, then ask the backend for the `desktop_id` lock if the step types or clicks.
2. Read the snapshot/capabilities. For reliable accessibility elements use Agent Desktop; for system work use Windows-MCP.
3. Pick the right tool and its runtime schema from the server's `list_tools`; never guess parameter signatures.
4. Call the tool once. Log `step_id`, provider, tool name, time and status minimally.
5. Observe the success condition again, independently of the response; record the completed idempotency key.
6. If the tool fails: decide whether it may already have taken effect. Retry only if upstream says `retry=safe` or a check proves no effect happened. With an old ref, refresh the snapshot first.
7. No progress for two cycles, a desktop conflict, or a needed permission the host does not grant → `HALTED`, with the reason and the current state.

## Fallbacks

- Agent Desktop cannot locate the element: a fresh Windows-MCP `Snapshot` + `Click`/`Type`; never reuse old coordinates.
- Windows-MCP has no permitted file tool: never imitate deleting/writing files with the mouse to get around policy.
- One provider disconnects: if a step with side effects has an unknown outcome, only observe; never re-run it at once with the other provider.

## Context control

Keep `task_id`, `step_id`, `window_id`, `snapshot_id`, the expected state and a short digest. Never keep full screenshots or clipboard content in the model history. Do not merge unrelated output into one tool response. Retries and checkpoints belong to the host; the prompt cannot replace the backend's guards.
