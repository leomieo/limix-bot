# Limix Bot connected-apps broker

This Worker keeps the shared Composio project key out of desktop builds. Each
installation receives a random bearer token stored only as a SHA-256 hash in
D1. The Worker gives that installation its own Composio user/session, proxies
MCP traffic, and returns short-lived Connect Links to the local app.

The desktop never receives the project key. Authorization links are returned
only on demand and are never persisted in chat messages.

## Limix production deployment

The packaged client uses `https://composio.limixmedia.com`. Deploy this Worker in the Limix Cloudflare account that owns the zone, using a dedicated Limix Composio project. Keep the project API key in the Worker secret store. A change of project requires users to reconnect their external accounts.

1. Create the D1 database `limix-composio` (or select the existing Limix database) and set its UUID as `database_id` on the `DB` binding in `wrangler.jsonc`.
2. From this directory run `pnpm exec wrangler d1 migrations apply limix-composio --remote`, then `pnpm exec wrangler secret put COMPOSIO_API_KEY` and enter the Limix project key at the prompt.
3. Run `pnpm exec wrangler deploy`. For app events, configure the project's webhook and its signing secret as described below.
4. Before distributing the desktop update, verify the public health endpoint reports `limix-composio` and `ready: true`. With an isolated desktop installation, verify registration, restart, authorization of a test account, and a read through that connection. Health alone checks only the presence of the project key.

## Development and self-hosting

Run the type and integration checks against a disposable configuration. For a
self-hosted broker, create a separate Worker, database and rate-limit bindings
in your own account. Provide credentials through the platform secret store.
A standalone local server can also use its own connector project key.

## App events (Composio triggers)

The broker also receives Composio trigger events for every installation and
queues them until the installation's OMB server collects them. A desktop
needs no public URL: Composio posts to the broker, the server long-polls it.

```
Composio --signed POST--> /v1/composio/webhook --> D1 queue per installation <-- GET /v1/events (25 s long-poll)
```

### Routes

| Route | Auth | Does |
| --- | --- | --- |
| `POST /v1/composio/webhook` | Composio signature (`COMPOSIO_WEBHOOK_SECRET`) | Verifies the Standard Webhooks signature (300 s tolerance), routes `metadata.trigger_id` through `trigger_bindings`, requires `metadata.user_id` to be that installation's Composio user, and queues the event. A bad, missing or stale signature gets 401; an event no installation can take gets 200 and is only counted. |
| `GET /v1/trigger-types[?toolkits=a,b]` | installation token | Event types of the given toolkits (at most 10), or of the installation's active connected accounts. Types that need their own webhook endpoint are left out. Cached per isolate for an hour. |
| `GET /v1/trigger-types/:slug` | installation token | One event type with its config and payload schemas. |
| `POST /v1/triggers` `{slug, connectedAccountId, config}` | installation token | Checks that the account is this installation's, then `POST /trigger_instances/{slug}/upsert` and saves the binding. An identical config returns the same `triggerId`, so local triggers can share one. |
| `PATCH /v1/triggers/:triggerId` `{enabled}` | installation token | Enables or disables the instance at Composio (only disabled once no other binding wants it). A config change is a new `POST` plus a `DELETE` of the old instance. |
| `DELETE /v1/triggers/:triggerId` | installation token | Removes the binding, its queued events and drop counts, and the Composio instance once nothing else binds it. Also deletes an unbound instance of this installation's Composio user. |
| `GET /v1/triggers` | installation token | Bindings beside Composio's view (`remote.state`: `enabled`, `disabled` or `missing`), `unbound` instances, drop counts per trigger, limits and today's usage: everything the server's reconciliation needs. |
| `GET /v1/events?after=<seq>&wait=<0-25>&limit=<1-50>` + header `x-omb-poller` | installation token | Acks every event at or below `after`, then returns the next events in arrival order, holding up to `wait` seconds. One poller at a time per installation: another `x-omb-poller` gets 409 until the 90 s lease runs out. |
| `POST /v1/events/test` `{triggerId, data}` | installation token | Queues a synthetic event (`type: "omb.test"`) through the same queue and limits. |
| `PUT /v1/installation/cloud` `{grant}` | installation token | Marks the installation as a paid Cloud's from an Admin-signed grant. |
| `POST /v1/installation/share` `{for}` | installation token | A one-time code (10 minutes, only its hash kept) that lets the installation `for` act as this installation's Composio user. |
| `POST /v1/installation/adopt` `{code}` | installation token | Redeems a code minted for this installation: from then on it acts as that Composio user (`shared_user_id`). Refused with 409 `has_connections` while it has active connected accounts of its own, which stay reachable. The code is spent either way. |
| `DELETE /v1/installation` | installation token | Erases the installation and what it created at Composio. See [Erasing an installation](#erasing-an-installation-and-what-the-broker-keeps). |
| `GET /v1/stats/app-events?days=<1-90>` | `Bearer STATS_TOKEN` | Fleet totals per day (queued, delivered, duplicates, drops, expired, unrouted) and current counts. Counts only, never event contents or installation ids. |
| cron `23 * * * *` | | Expires events not collected within 7 days, disables at Composio the triggers of installations that have not polled for 14 days (re-enabled on their next poll), keeps daily counts for 90 days. |

### One person's desktop and Cloud

Composio ties every connected account to one user, and a tool router Session
uses only its own user's accounts, so a person's desktop and their own Cloud
share connected apps by acting as one Composio user. The desktop app mints a
code for the Cloud's installation id, which the Cloud reports to the app over
its owner session (the Admin verified that Cloud as the person's); the Cloud's
server redeems it. A code works only for the installation it names, once,
within 10 minutes. Sessions, the connected inventory, triggers and the event
routing all follow the installation's acting user; an instance one sharing
installation binds is never listed as unbound to the other. `GET /v1/me` adds
`user`, a digest of the acting user, equal on two installations exactly when
they reach the same apps.

Deploy order: apply `0004_shared_users.sql` first (additive), then the code.
Every query reads `installations.*`, so the new code also runs on a database
without it: `GET /v1/me` then carries no `user`, so no desktop tries to share,
and sharing answers 503 until it is applied.

### Limits

| | Desktop | Paid Cloud |
| --- | --- | --- |
| Events queued per UTC day | 500 | 2,000 |
| Waiting in the queue | 1,000 events or 20 MB | same |
| Event `data` stored | 64 KB, then a truncation marker with a preview | same |
| Kept when not collected | 7 days | same |

An event over a limit is answered 200 to Composio, not queued, and counted on
its trigger (`event_drops`, shown by `GET /v1/triggers`) and in the daily
counts. Status events (`composio.trigger.disabled`,
`composio.connected_account.expired`) skip the limits and carry ids only.

### Paid Clouds

Registration is open, so a Cloud proves its plan with a grant the Cloud Admin
signs. The grant is `v1.<machine id>.<signature>`, where the signature is
`base64url(HMAC-SHA256(CLOUD_GRANT_SECRET, "omb-connected-apps-cloud:v1\n" + machineId))`:

```js
import { createHmac } from "node:crypto";
const grant = `v1.${machineId}.${createHmac("sha256", CLOUD_GRANT_SECRET).update(`omb-connected-apps-cloud:v1\n${machineId}`).digest("base64url")}`;
```

The Admin sets it as the machine's `OMB_CLOUD_CONNECTED_APPS_GRANT` secret
for paid plans only. The Cloud's server presents it after registering
(`server/cloud-connected-apps.ts`). One machine id holds the Cloud limit on one
installation at a time: presenting the grant again moves it.

### Waking a sleeping Cloud

A Cloud on a plan that sleeps when idle collects its events only while it is
awake. When an event is queued (not dropped, not a duplicate) for an
installation that has a `cloud_machine_id` and is not polling (its poll lease
is unset or has run out), the broker asks the Cloud Admin to start that
machine, at most once a minute per installation (`wake_requested_at`):

```
POST <CLOUD_ADMIN_URL>/api/cloud/machines/wake
content-type: application/json
x-omb-wake-timestamp: <unix seconds>
x-omb-wake-signature: v1=<base64url(HMAC-SHA256(CLOUD_GRANT_SECRET, "omb-cloud-wake:v1\n" + timestamp + "\n" + machineId))>

{"machineId":"<machine id>"}
```

The Admin accepts a timestamp within 300 s, each signature once, and answers
`202 {waking}`. The request runs after Composio has been answered
(`ctx.waitUntil`); a refusal or failure is logged without the key and never
fails the event. It is off unless both `CLOUD_GRANT_SECRET` and
`CLOUD_ADMIN_URL` (an `https://` origin) are set, so a deploy without them
changes nothing.

### Webhook setup

For a self-hosted instance, apply the database migrations and register your
own HTTPS webhook URL. Configure signature verification in the Worker and
the provider dashboard. Test delivery with synthetic data before opening the
endpoint to real events.

## Erasing an installation and what the broker keeps

`DELETE /v1/installation`, with the installation's own token:

| Answer | Means |
| --- | --- |
| `200 {erased: true, sharedUserKept}` | Everything is gone and the token no longer works. |
| `202 {erased: false, more: true}` | Call again. One call makes at most 30 Composio deletes, to stay inside a Worker's per-request limits. |
| `401` | Bad token, or already erased. |
| `429`, `502`, `503` | Nothing is lost: the token still works, so call again. Finished work is not redone. |

It removes share codes the installation minted or was named in, then at
Composio its triggers and connected accounts (`revoke_on_delete=true`), then in
one D1 transaction its rows in `trigger_bindings`, `events`, `event_drops`,
`app_event_days`, `user_shares` and last `installations`. It needs migrations
through `0004`; before that it answers 503 and changes nothing.

A trigger another installation also binds stays at Composio. A Composio user
another live installation still acts as (a desktop and its Cloud) keeps its
connected accounts and unbound triggers: `sharedUserKept` is `true`, and they go
when the last installation using that user is erased. An installation that
adopted a shared user also clears its own original Composio user.

Kept without an erase:

| Data | Kept |
| --- | --- |
| `installations` | Indefinitely: only an erase removes a row. |
| `events` | Unread: 7 days. Read: body cleared at once, the id kept for 7 days to spot duplicates. |
| `trigger_bindings`, `event_drops` | Until the trigger is deleted. |
| `app_event_days` | 90 days. Counts only. |
| `user_shares` | Until used; an expired code, until the next code is minted. Hash only. |
| Composio connected accounts and triggers | Until disconnected or deleted. A trigger is only paused after 14 days without a poll. |

An erase does not reach Composio's tool router Sessions (the broker has no call
that deletes one), the `''` row of `app_event_days` (deliveries no installation
owned), Worker logs (which carry installation ids), or a copy of the token on
the customer's side.
