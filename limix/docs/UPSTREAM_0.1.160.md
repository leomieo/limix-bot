# OpenMausBot 0.1.160 integration (batches 1–3)

Source: https://github.com/milind-soni/OpenMausBot/releases/tag/v0.1.160 (`d3813518d520bd5be4392c0501d6ff3013415057`),
compared with 0.1.155 (`8b17baf6f`). 424 upstream commits in between. Selective backport, as for 0.1.155. Branch
`upstream-0.1.160`, based on `main`; not released.

## Batch 1: included (53 commits, cherry-picked; conflicts resolved for Limix)

| Area | Upstream commits | Limix adaptation |
| --- | --- | --- |
| Engine start-up: brief provider errors, handshake pipe failures, wrapped certificate failures | `3065885`, `03d4b0b`, `b4aa937` | none |
| OpenAI-compatible models sending empty tool arguments | `f32eee4` | none |
| Usage limits: a teammate's job carries on with another AI; a bot-to-bot turn that hit its limit before running is resent once to the backup AI | `baa56c2`, `4425b30`, `070de40`, `bff6d1d`, `c3e07a4` | `turnLimitScope` reuses Limix's `takeoverRefusal` |
| Length-cap hand-off keeps the active task and steering; a teammate's report keeps the warm engine | `605fd9a`, `051eb26` | upstream webhook-filter test not imported (feature absent) |
| Antigravity uses the bot's skills (staged in the turn workspace and managed profile, protected from boxed agents) | `c518c56`, `3bd1bcd`, `e80862b`, `ede5991`, `86d6d86`, `f1e7d55`, `2e3956e`, `83a075c` | turn text keeps Limix's form (no upstream `posted` prefix) |
| Automations: "To review" only when a run needs the person; long closing questions kept; NEEDS INPUT clipping; limit-reset runs not skipped; fewer usage reads on a quiet machine | `d7aee75`, `410f8c4`, `e50c1cf`, `0890728`, `04d3dcb`, `d030e2e`, `07552cb`, `2e0c3b9` | a room keeps Limix's `patchGroup` unread mark |
| MCP output limit kept when a bot or the turn folder sets it; whole-payload gates; big URL-server results saved to a file; structuredContent trimming | `83d238f`, `6e00155`, `7fa3d60`, `7ec3ed6`, `e3f049c`, `21c96aa` | Claude driver keeps Limix's PATH handling |
| Sign-in filling inside shadow roots; plain refusal on a computer screen | `b6ba999`, `c6ff284` | message names Limix Bot |
| Chat: a link to a delivered file opens the right copy | `697a4d0`, `b72075f`, `20b2df6`, `7f31c11`, `2209d5c`, `3b2235d` | none |
| Rooms: long sender names aligned, other people's lines named; Stop once per stopId | `880b0c0`, `abc9f70`, `b597535` | one upstream test for a speaker-arrow feature Limix lacks was left out |
| Desktop starts without a Documents folder; multichannel microphones; asterisk emphasis; typed server address; TLS terminator on another host; Ollama cloud models; shared computer re-pairing and stale polls; 👍 means go ahead only after a question | `01dd26b`, `4aca0de`, `c5ca99f`, `af16f9b`, `5741fe2`, `4d1f98c`, `aff2251`, `3e5eca4`, `82e8ef6` | Documents folder test expects `Limix Bot` |

Skipped: `b2e8ad1` (`productName()` does not exist in Limix; Limix keeps its own product name).

## Batch 2 (owner's choice 16/11: pause, lighter bots, archives, themes and pictures)

Included (cherry-picked, conflicts resolved):

| Behavior | Upstream commits | Limix adaptation |
| --- | --- | --- |
| Pause a bot or a whole department until resumed; running work stops, its room is told, routines and webhook runs skip quietly, no backup-AI resend | `a72a3f1`, `4041e67`, `0d66db9`, `0d21b18`, `e4da259`, `0667e88`, `4efc19a` | sidebar department menu keeps Limix's owner and reports items; the routine option `personTurn` (from a feature Limix lacks) is left out; Vietnamese strings added |
| Claude turns defer all but a few agents tools, loading them when a turn needs them; the switch reaches the bot box | `c294c63`, `90fcbd8` | Limix keeps its spawn-contract code in place; tool-catalog goldens regenerated for Limix's catalog and the budgets moved on purpose |
| Any file type attaches as a plain download; archives pasted from Explorer/Finder; bots send archives (.zip, .tar.gz, .7z…) to the chat | `f42488d`, `ccbe58b`, `a6cd67c` | none |

Not included in batch 2:

- Themes by bots, undo a look change, bot and person pictures (`16fce7b`, `91b920c`, `a24ca8f`): each extends upstream's
  `app_settings` tool (bots change app settings on Change/Cancel cards), which Limix never imported. They need that tool
  first: a separate, larger integration.
- Turning off a bot's Meetings/Data/Pages/Images/Email tools (`a1a1b04`): it also builds on `app_settings`, upstream's
  browser-profile proposals and the phone-protocol package.

Batch 2 checks: `tsc` (UI and server) pass; the 17 test files it touches have no new failure against `main` (14 failing
on the branch, 17 on `main`, all pre-existing); new `agents-claude-defer` and `turn-prompt-budget` tests pinned to
Limix's sizes; `PauseMenus.dom.test.ts` cannot load here (node:sqlite bundling, as other UI DOM tests on `main`).

## Batch 3 (owner's go-ahead 16/11): app_settings, themes, pictures, tool groups

- app_settings (bots change the app's own settings by chat, each with Undo or a Change/Cancel card; window preferences;
  pin bots; add/remove AI engines): `053ef19`, `aab5a38`, `58c1ee2`, `a7571dd`, `2b93c7a`, `899a20d`, `334f977`,
  `73414bf`, `c52f8cb`, `3e0d84a`, `1d5360d`, `5524cc2`, `2d5a539`, `8e1fb20`, `eb8fc38`, `c6f8709`, `b1638c3`,
  `6637b26`. Left out: the browser SOCKS5 proxy setting (`5c339c1`, needs upstream's browser-proxy feature).
- Bots set a bot's picture or the person's photo from a picture file: `a24ca8f`.
- Bots restyle the app with custom themes; undo a look change or go back to an earlier theme: `16fce7b`, `91b920c`.
  "Your themes" sits under Settings → Appearance (and the Simple looks page); the settings primitives the page uses were
  added to Limix's SettingsPrimitives.
- Turn off a bot's Meetings, Data, Pages, Images or Email tools: `a1a1b04`. The tool-group list matches Limix's catalog
  (no app hosting tools; `diagnose_limix` is core); group sizes re-estimated; `shared/tool-groups.ts` holds the code
  directly (Limix has no phone-protocol package).

Batch 3 checks: `tsc` UI and server pass; tool-catalog goldens regenerated and budgets moved on purpose; of the 31 test
files touched, the only failures not also on `main` are `theme-css.dom.test.ts` (cannot load here: node:sqlite
bundling, as other DOM tests) and a temp-folder cleanup race in `server/email/host.test.ts`.

## Not in batches 1–3 (candidates for later batches)

- rename_thread (`6de0983`),
  propose_profile (`057b650`, `cbc0546`), built-in browser beside the cloud computer (`b16d1b9`, `b02061d`).
- Engines: Devin (`5eb9d5f`), Mistral Vibe (`81386e5` and follow-ups), Gemini decider on OpenRouter (`5c5d6f3`),
  custom decider endpoint (#5150).
- Live calls: Gemini Live, ElevenLabs Agents.
- Phones: relay pairing repair, connection check, phone-protocol package. Limix runs its own phone/relay setup, so these
  need their own review.
- browser SOCKS5 proxy, settings search, skill limits (64 KB SKILL.md, 120 skills per package).
- MausBot Cloud specific changes (Codex update card on My Cloud, Team Cloud).

## Verification

- `tsc -p tsconfig.json` and `tsc -p tsconfig.server.json`: pass.
- The 50 unit test files the batch touches (no e2e, no `server/index.test.ts`): 48 failing tests on the branch, all of
  which also fail on `main` (53 failing there: several fixed by the batch). No new failure.
- `electron/cloud-sync-main.node-test.mjs`: 3/4; the remaining failure also fails on `main`.
- Not run: `server/index.test.ts`, e2e suites, packaged app, real engines and accounts.

## Reproduction debt

As with the Cloud work, the adapted changes are committed to the source tree; `limix/patches/upstream-0.1.160.json`
has not been generated yet, so `limix/rebrand.py` from a clean upstream would not reproduce them.
