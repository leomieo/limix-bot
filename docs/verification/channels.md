# Channels

## Sub-features

- Create a channel from existing bots.
- Send to its active task.
- Wait for the room-level run rather than one member's transient state.
- Read a bounded channel transcript.

## User path

Create a channel from the sidebar, choose its members, and send a message in
the channel composer.

## Driving it

Create two fixture bots with `new-bot`, then:

```sh
pnpm control:omb new-channel --name Review --members BOT_A_ID,BOT_B_ID --url http://127.0.0.1:PORT
# Copy channel.id from the JSON above as CHANNEL_ID.
pnpm control:omb send-channel --channel CHANNEL_ID --text "Reply once" --url http://127.0.0.1:PORT
pnpm control:omb wait --channel CHANNEL_ID --timeout 60 --url http://127.0.0.1:PORT
pnpm control:omb messages --channel CHANNEL_ID --limit 20 --url http://127.0.0.1:PORT
```

Capture the returned channel ID from `new-channel`. The wait result must be
`settled`; the transcript is the evidence.

## Gotchas

- Do not wait directly on a bot while it is speaking for a channel.
- A confirmation card produces `needs-user`; it is not a timeout.
- This first map does not claim to verify channel layout or sidebar UI.

## Chief room management

```sh
pnpm exec vitest run server/chief-rooms.e2e.test.ts
pnpm exec vitest run server/index.test.ts -t 'Chief room|team-goal lead|credential-card ownership'
```

The end-to-end test launches the isolated control fixture, creates disposable
bots, starts its fake Chief engine and uses that turn's mounted agents MCP
proxy. It creates a room, renames it, changes members and its bulletin, then
checks the saved state. A foreign-section member is refused; stopping the
owning turn revokes the proxy's permission to rename the room. The test retains
its control commands, tool results and final state beside the printed server
log, without recording the bearer token, and removes its temporary home.

The API regressions exercise spoofed sender/thread claims, slow expired
requests, current Chief status, peer allow-lists, hidden bots, creation limits,
busy rooms, pending approvals, goal leads and in-flight credential saves.
Public channel creation and edits use the same validation as the Chief tools.
Chiefs cannot move rooms/bots between sections, remove themselves, or change
working folders. These tools add no separate approval workflow.

## Reply to a channel chat: final answer only

`replyText` in `server/bot-api-host.ts` hands the caller (and so the Telegram chat when the owner asks the bot to reply) the
turn's terminal text. The progress notes a bot wrote on the way are no longer joined into it; texts with no turn id (older
rows) are still all kept. Covered by `server/bot-api-host.test.ts` ("sends the final answer only…"). Not yet measured with a
real chat: timing from request to delivery, and delivery count.
