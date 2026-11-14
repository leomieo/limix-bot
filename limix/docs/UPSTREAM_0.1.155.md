# OpenMausBot 0.1.155 integration

Source: https://github.com/milind-soni/OpenMausBot/releases/tag/v0.1.155

Pinned release: `8b17baf6fabfeb52615bc5b78127e04e797934c0`. Compared with the original Limix source pin `6f226f15def56c697626f2ed6dffac416510c79a`. This is a selective backport, not a wholesale baseline upgrade. OpenMausBot source remains Apache-2.0; its enterprise directory and trademarks are not imported.

## Included

| Behavior | Upstream commits | Limix adaptation |
| --- | --- | --- |
| Attach archives as bounded plain files, never unpack them | `73e9f6962`, `4022e4faf` | Keep executable/script restrictions and download protections |
| Mark replayed images as belonging to earlier messages | `da4a77cca` | Keep the technical note in English |
| Avoid Copilot's reserved browser/computer MCP namespaces | `926d36629` | Use collision-safe `limix_` names |
| OpenCode Go limits leave the free-model allowance available | `65a6817de` | Keep existing account routing |
| Distinguish system stops from a person's stop in delegated work | `7e1e7d95d` | Preserve permission and stop semantics |
| Claude 5-hour/weekly usage reporting | `f6271f62a` | Keep explicit `usageMeter: false` opt-out; no credential logging |
| Windows-1252 Markdown preview and clear server refusal text | `2a4303b18` | English and Vietnamese refusal messages |
| Drag rooms within their sidebar list, or use Alt+Up/Down | `7e0449849`, `0e4a0ccbe`, `15c7e20c1` | Preserve Limix sidebar/sign-out changes; authenticated admin route, filtered broadcasts, serial saves and rollback only of moved rooms |
| Avoid duplicate read requests when following notifications | `7a72b8bce` | Backport the in-flight timestamp guard without the separate renderer/store rewrite from `b692f4709` |

## Deliberately excluded

- `3b2f9895d` (settle old question cards on a typed reply) was reverted by upstream `8f1b180c1` before the release: late answers and call answers could be lost. The release notes still mention it, but the tagged source does not include it. Limix follows the final source.
- MausBot Cloud recovery/replacement and Team Cloud changes depend on upstream hosted services. Limix Cloud and account sync stay disabled as requested; no service is enabled by this backport.
- OMP, Fish Audio live calls, Android takeover, 1Password item-level grants, webhook filters/conversation reuse, post-to-thread, room exchange side views, and optional VPS wake scripts are not included in this batch. They span separate permissions, provider or runtime integrations and need their own compatibility checks. No corresponding working feature is claimed.
- Upstream Import & export navigation is not copied over Limix's account-bound Chuyển máy Offline page.

## Reproduction and verification

`limix/patches/upstream-0.1.155.json` applies the adapted source changes after the existing Limix patches. New files use `limix/overlay/`. `limix/rebrand.py` runs the patch idempotently. The original baseline is retained.

`node scripts/verify-limix-upstream.mjs` runs the affected unit/DOM tests, a disposable engine-limit fixture and real isolated HTTP tests for room order/SSE and archive upload. macOS/Linux CI runs this gate before packaging. Local Windows cannot create the file symlink used by one existing image-admission test without additional OS permission; the test remains active in CI.

Tests use synthetic providers and throwaway homes. These checks do not establish real-account Claude/Copilot/OpenCode acceptance, actual mouse dragging in a packaged GUI, or installed-client updater acceptance.

The preceding 0.3.34 all-platform build passed packaged server checks on Windows, Apple Silicon, Intel and Linux, but the final publish gate rejected a macOS DMG filename mismatch: electron-builder's feed normalized the space in `Limix Bot` to a hyphen. Version 0.3.35 uses `LimixBot-${version}-${arch}.dmg` consistently in the builder and collection workflow. The hash gate remains required; the failed build was not published.

Local Windows result: 22 affected test files passed, 897 tests passed, 5 skipped (4 existing conditional cases plus the OS-restricted symlink case). The two selected isolated HTTP tests passed. UI/server TypeScript and Vite build passed. Rebrand reconstruction from `4aaad48` followed by another run had no source mismatches and no second-run changes. Native CI still has to run the unfiltered suite, package every platform and validate the update feeds before publication.
