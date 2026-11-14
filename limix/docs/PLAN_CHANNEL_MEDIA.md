# Channel media expansion

Status: implementation and isolated verification in progress. Live platform delivery remains NOT_TESTED.
Requested 2026-11-14: configurable customer-facing connections for Telegram, Zalo, Facebook/Messenger, Discord and extensible additional platforms, including incoming and outgoing files, images, video and audio.

## Original audit gaps (addressed below)

- `limix/gateway/src/channels/{telegram,zalo,discord}.mjs`: attachments=false; outbound adapter currently sends text only.
- `limix/gateway/src/router.mjs`: private non-text events receive TEXT.textOnly; group non-text events are ignored. Bot replies are routed as text.
- `limix/gateway/src/engines/openmausbot.mjs`: message/thread exchange must be extended alongside the authenticated Bot API. Adapter-only uploads cannot deliver media end to end.
- Gateway has no Facebook/Messenger adapter or setup choice.
- Generating an image and delivering that image through a messaging connection are independent capabilities.

## Platform evidence

- Telegram: https://core.telegram.org/bots/api — file download, photo/video/audio/voice/document sends; preserve topic/reply identifiers and captions.
- Discord: https://docs.discord.com/developers/reference#uploading-files — multipart uploads and message attachments; validate permissions/intents and channel/thread routing.
- Messenger: https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start — images/audio/video/files supported by Messenger Platform. Page identity, webhook verification, signature checks and app permissions are required parts of the integration. User explicitly requested BOTH Facebook Pages and personal accounts. Implement these as separate connector types; do not treat the Page API as personal-account access. A supported personal-account integration has not been established and must not be advertised as ready.
- Zalo Bot: https://docs.zaloplatforms.com/docs/BOT/apis/sendPhoto — image URL and optional caption.
- Zalo Bot: https://docs.zaloplatforms.com/docs/BOT/apis/sendVoice — AAC URL, private chat only, no caption; group sends can report success without delivery. Never advertise group voice support.
- Zalo OA is a separate integration; confirm method-level documentation for each media type. Marketing overview text is insufficient evidence for video/document upload endpoints.

## Required implementation

1. Capability matrix per platform, account type and conversation type. Distinguish supported, missing permission, not implemented and disabled by the customer. Do not expose all capabilities as enabled merely because a token was accepted.
2. Persist per-connection settings: inbound/outbound text, images, video, audio/voice and documents; allowed types, byte/count limits, retention, private/group/mention modes. Show only applicable options and explain platform restrictions.
3. Normalize attachment metadata and delivery context. Authorize sender before downloading; constrain platform CDN sources and redirects, enforce streaming size/time limits, safe filenames and storage isolation. Never forward secrets or fetch arbitrary internal URLs from messages.
4. Extend the authenticated bot input/output contract for scoped attachments. Preserve owner/member boundaries and ensure a generated output belongs to the authorized bot/thread; never accept arbitrary local paths as send requests.
5. Implement receive/download and send/upload adapters. Keep captions, reply targets and threads. Audio transcription and video understanding require separate available processing capabilities; receiving a file does not prove the selected AI understands it.
6. Delivery state per item with provider message IDs, partial failure reporting and retry policy. Do not re-send an entire album after a partial success or silently duplicate a send after an ambiguous timeout.
7. Facebook Page setup must cover HTTPS webhook reachability, subscription, signature verification, credentials, permissions and account policy. Additional platforms require their own adapters and evidence, not an unrestricted generic connection.

## Acceptance

- Isolated fake-provider tests for media-only messages, captions, mixed files, oversized/disallowed files, denied users, group/topic routes, download redirects, expired URLs, partial send failure, retry/deduplication and restart.
- UI tests verify persistence and platform capability enforcement on the server, including tampered requests.
- Real account acceptance: actual incoming file reaches the selected bot, outgoing result appears in the correct platform chat, and platform message IDs/receipt are recorded. Mock tests and a successful API response alone are not live delivery proof.
- Release across Windows, macOS Apple Silicon/Intel and Linux only after relevant checks pass. No version bump or release is made by this audit.

## Implemented 2026-11-14

- Telegram/Discord normalize incoming media and upload binary replies; captions, Discord mentions/replies and Telegram topic routing are retained. Telegram albums currently arrive as individual messages, not one assembled album.
- Authenticated Bot API accepts up to four base64 attachments (10 MB combined), stores via the existing quota-controlled attachment store, and returns only attachments explicitly emitted by the bot within the current API reply. Forged image/file tags are defused; arbitrary local paths, symlinks and tool-result images cannot be exported.
- Per-connection receive/send toggles, kind allowlist and byte/count limits. Sender authorization precedes download and is checked again when queued work starts. CDN allowlists, no redirects, HTTPS and bounded streaming apply. Unrecognized Zalo CDN origins are rejected pending verification.
- Zalo Bot receives image/voice events; sends images and private AAC voice with optional HTTPS media publishing. Video/document sending remains unsupported by this adapter.
- Facebook Page adapter: Page token identity check, configurable Graph version (v22.0 default), signed webhook, verify challenge, page isolation, echo suppression and persisted deduplication. Text and media responses use the Page API. Needs a user-managed HTTPS proxy forwarding only /hooks/facebook/* and /hooks/limix-media/* to the gateway listener. Server main-app proxy ingress is not automatically provisioned.
- Public outgoing URLs contain 256-bit bearer secrets, expire after five minutes and store at most 40 MB in memory. They expose only selected outgoing bytes. Receiving media does not require public hosting.
- Outgoing files are sent in order with provider receipt IDs. A failed or ambiguous send stops the batch and reports partial progress without automatic file retries. Accepted provider response is not proof of recipient delivery.
- Facebook personal account remains visibly unavailable: no supported official API has been verified. WhatsApp/Zalo OA and other new platforms are not implemented in this change.
- Retention uses the app's existing attachment quota and cleanup UI; no new automatic retention policy. Speech transcription, media generation and video understanding depend on the chosen AI/tools.

## Verification

PASS_MOCK: gateway media/routing/security and HTTP webhook fixtures; isolated Bot API HTTP tests; isolated full server with fake AI receives a document and returns its reply. TypeScript build passes. A Windows symlink fixture in existing turn-images tests fails at setup with EPERM; this is not a successful symlink runtime check. Live platform accounts, public HTTPS routing, packaged UI and recipient delivery remain NOT_TESTED.

Local results: gateway 49/49 PASS_MOCK; Bot API/media focused full-server fixture 3/3 PASS_MOCK; TypeScript project build PASS. Broader attachment/ingress results recorded in PROJECT_MEMORY.md. No new desktop version has been published for this change.
