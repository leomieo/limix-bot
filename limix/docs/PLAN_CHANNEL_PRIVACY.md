# Connected-channel conversation privacy

Requested 2026-11-15: separate desktop configuration chat from channel conversations; bind conversations to platform IDs; hide customer history by default; viewing/managing requires the current Limix account password.

## Implemented locally, not released

- Desktop navigation ignores API activity and opens a local/main chat. Explicit channel transcript inspection is read-only in the composer, with an Open internal chat button. Server refuses ordinary desktop messages in API threads.
- Channel titles identify Zalo/Telegram/Discord/Facebook. Gateway waits only on explicitly retryable pre-admission busy responses; accepted messages are never replayed after ambiguous network failures. Accepted thread mapping is saved before polling.
- Identity metadata binds API threads to platform, connection, chat, sender/topic and owner/guest lane; GET and POST both enforce matching identity. Private conversations have per-sender identity; a group has shared group history, not an invented private history for its members. Existing mapping is not reused for the new canonical session keys; old transcripts retained.

## Required before privacy release

- Verify current Limix account password using the existing account service, without login/session rotation. Require online verification, throttle attempts, never retain password or send it to an AI.
- Mint a short-lived review capability through trusted desktop main IPC. Bind access to the window/session, expire automatically, provide Lock now, revoke on sign-out/restart.
- Enforce locked visibility on HTTP, snapshots, SSE/replay, search, attachments, exports and activity previews. Hide all legacy botApi threads too. Reuse existing VisibleSet filtering with per-session grant, never a global unlock.
- Add customer conversation browser grouped by platform/user ID. Unlock before loading history; clear renderer transcripts on lock and expiry.
- Prove cross-user/platform separation, wrong-password/offline rejection, session isolation, expiry, SSE and attachment refusal, and restart behavior in isolated fixtures before release.

Current state 2026-11-15: implemented five-minute launch-local review grants. Electron main verifies the signed-in username/password through the read-only account machines endpoint, then requests a one-use ticket with its owner-lane secret. Renderer redeems it for an HttpOnly SameSite cookie. Visibility filtering hides API threads from snapshots, transcript/attachment access and SSE; archives/search/activity routes require unlock. Lock revokes grant; UI reload clears cached state, expiry reloads within five minutes. Legacy API call attempt previews are suppressed while locked. No plaintext password is retained. Online verification is required; no offline master bypass. HTTP fixture verifies hidden snapshots/history, cross-user refusal and forged grant rejection. Real account password verification UI is NOT_TESTED. No claim of encrypted-at-rest transcript storage. No live Zalo/Telegram verification. Do not publish as a completed privacy feature.
