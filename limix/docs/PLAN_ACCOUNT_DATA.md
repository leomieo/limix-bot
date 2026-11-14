# Account data and offline transfer plan

Decision 2026-11-14: build account-data sync as a hidden module. No server exists yet; keep `LIMIX_ACCOUNT_SYNC_ENABLED = false`, no automatic upload and no customer-facing sync UI. This is separate from paid bot execution in Limix Cloud.

## Implemented locally
- `limix/account-sync/`: bounded portable snapshot protocol, installed skill source capture, secret scrubber adapter, compressed transfers, authenticated HTTP handler factory, AES-256-GCM encrypted transactional SQLite storage (five revisions per account), revision conflicts, serialized client and empty-profile restore adapter.
- All network and storage wiring is explicitly injected. Not registered with the running app or deployed. Production identity validation, key management, per-account profile switching and background lifecycle integration remain required before activation.
- Restored account-sync skills are staged outside active skills for review. Existing portable team importer restores routines paused and reconnects credentials separately. This is not yet full-fidelity multi-device merge.
- Native Node fixture tests: 9/9 passed. Real temporary encrypted database with in-process HTTP Requests; no real account server or two-device acceptance.

## Offline computer transfer
- Visible Settings page: **Chuyển máy Offline**. Reuses encrypted workspace snapshot/restore with password (12+ characters), preview, explicit REPLACE, safety copy and app restart.
- UI export omits media and attachment/upload folders. Memory, installed/learned skills and text history remain. Login credentials, remote desktop disks and dependencies follow existing backup exclusions.
- Restore only into the same or a newer application version. Strict SemVer core/prerelease comparison; reject unknown or malformed versions when the production route provides its current version.
- No server required. Must verify export/import and restart on isolated runtime before release; never mutate customer data for tests.

## Next gates
- [ ] Register identity/auth adapter and encrypted store on Limix server; keep token/key out of renderer and logs.
- [ ] Atomic profile ownership and durable restoration receipts; handle default-bot bootstrap, account changes and partial restore safely.
- [ ] Incremental sync and explicit cross-device conflict resolution; no last-writer-wins data loss.
- [ ] Restore reviewed skill revisions with per-bot assignments and ID mappings; distinguish executable files from metadata.
- [ ] Rate limits, storage quota, server backup/key recovery and deletion policy.
- [ ] Real machine A -> new machine B acceptance, offline/retry/restart and cross-account isolation.
- [ ] Enable only after all deployment/acceptance gates pass.

## Additional accepted work in this session
- Remove assignment controls from global installed-skill management; retain assignment in each bot's Skills settings. Rename online catalog **Kho kỹ năng Limix**, local storage **Kỹ năng trên máy**.
- Diagnose ffmpeg-skill 404 independently from quarantine. Remote registry currently points at quarantine while file exists under skills; retry alternate area only on 404 and retain checksum validation and risk approval gates. Do not clear security findings automatically.
- Audit model-facing instructions: English technical core, Vietnamese human descriptions. Translate bundled rea-video and Agent-Reach reference guidance and technical leader prompt without changing CLI/API identifiers or user output language.
- Add macOS and Linux release artifacts/workflows; native CI build and packaged smoke checks required. Signing/notarization and actual GUI acceptance must be reported separately.

## Release orchestration 0.3.32
Unified `limix-desktop.yml` calls Windows build-only workflow and builds macOS arm64/x64 + Linux x64, verifies packaged server health on Apple Silicon, Intel and Linux, validates updater hashes, then publishes all desktop assets together. macOS lacks developer signing/notarization; auto-update acceptance remains unverified. Tool auto-install remains Windows-only. Site download buttons activate only for assets returned by the public latest-release API; FAQ starts closed. Native CI and live deployment evidence pending.

## Additional decisions before desktop release 0.3.33
- Offline transfer requires the same accepted Limix account at export, preview, commit and startup restore. Ownership is stored inside the authenticated encrypted manifest as a hash of the existing canonical Limix principal (`limix:<username>`), independent of machine ID or editable profile name. The account principal comes from the main-process sign-in gate through the server environment, never the HTTP request. Older unbound backups cannot prove ownership and must be re-exported. Account rename/subject migration needs an explicit recovery policy; this does not introduce account-isolated local profiles or protect against an OS administrator modifying code with the backup password.
- If account/version changes before startup restore, cancel the pending request without applying its data; preserve the archive job and show a blocked reason in backup settings.
- Sign-out confirmation uses the app ConfirmDialog. IPC checks the still-current username and serializes attempts; the existing sign-out service forgets credentials and restarts. No native Windows message box for this action.
- Explicit global npm CLI requirements install into userData/limix-tools/npm-tools and are on bot PATH. Project packages such as Remotion remain in a chosen project. The picker appears only after the user clicks Choose project folder in a review panel; installing a standalone tool never opens it.
- A real isolated managed-prefix install of agent-desktop 1.3.1 returned `agent-desktop 1.3.1` on Windows; this is CLI installation proof, not desktop-control/MCP acceptance.
- First unified run 43543525640: Windows package passed; Linux packages built but Python link check failed because Node cpSync rewrote relative symlinks into a deleted build scratch directory. Preserve verbatim symlinks and verify runtime after scratch cleanup. macOS tsc hit the default ~2GB heap; set build NODE_OPTIONS to 4096MB. No desktop 0.3.32 was published. npm/image 0.3.32 already published, so subsequent desktop/code release advances to 0.3.33.
