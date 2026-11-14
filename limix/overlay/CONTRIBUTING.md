# Contributing to Limix Bot

Thank you for helping improve Limix Bot. Report reproducible problems, propose focused changes, and submit pull requests to [leomieo/limix-bot](https://github.com/leomieo/limix-bot).

## Before making a change

- Read [AGENTS.md](AGENTS.md) and the [project rules](limix/docs/CLAUDE.md).
- Keep each pull request focused on one problem. Discuss larger architecture, account, permissions or data-format changes in an issue first.
- Use Limix Bot branding in the interface, public documentation, commit messages and release notes. Do not add external project names or automatic co-author trailers to integration commits. Preserve required license, copyright and third-party notices.
- Keep technical bot instructions in English. User-facing Vietnamese descriptions and translations belong in the locale and presentation layers.
- Reuse existing modules before adding dependencies. Explain any new runtime dependency.

## Development setup

Use Node.js 24 or newer and the pnpm version pinned in `package.json`. Real bot conversations also require a supported AI provider configured and signed in. Tests use isolated fixtures and synthetic providers.

```sh
git clone https://github.com/leomieo/limix-bot.git
cd limix-bot
pnpm install --frozen-lockfile
```

Run the server and frontend in separate terminals:

```sh
pnpm dev:server
pnpm dev
```

Use the addresses printed by those processes. For the Electron desktop shell:

```sh
pnpm dev:desktop
```

The desktop command stages the pinned tunnel connector for the current platform. Some native features need additional platform tools and permissions; consult the relevant module documentation before testing them.

## Code layout

| Directory | Purpose |
| --- | --- |
| `src/` | React interface, locale resources and client state |
| `server/` | Application server, provider drivers, persistence and tool permissions |
| `shared/` | Shared contracts and validation helpers |
| `electron/` | Desktop lifecycle, native integrations and update wiring |
| `limix/` | Limix modules, reproducible overlays, patches, branding and project records |
| `skills/` | Bundled bot skills |
| `scripts/` | Development, packaging and verification tools |

Application data normally lives in the user's `.limixbot` directory. Never use a customer's profile or a developer's live profile as a test fixture. Do not hand-edit generated `dist/`, `dist-server/` or packaged release output.

## Verification

Run the checks appropriate to the change:

```sh
pnpm typecheck
pnpm check:electron
pnpm test
```

For focused checks, use `pnpm exec vitest run <test-files>`. Follow [verification guidance](docs/verification/README.md) for server and conversation changes. Launch a disposable fixture before exercising mutations.

- Test observable behavior, permission boundaries and meaningful failures.
- Use temporary homes and synthetic provider credentials. Keep secrets out of logs, screenshots, fixtures, URLs and commit history.
- For UI changes, include before/after screenshots and verify narrow layouts, scrolling, focus, keyboard use and the active theme.
- For data migrations and offline transfer, verify account ownership, version compatibility, failed restores and preservation of existing data.
- State exactly what passed and what was not tested. A build or mock test does not establish real-provider, installed-client or updater acceptance.

## Limix modules and reproducibility

Keep reusable Limix-specific code in its existing module. Mirror overlay-managed source changes in `limix/overlay/`; maintain applicable patches and `limix/rebrand.py` transformations when changing core files. Verify reconstruction in a disposable checkout and verify that a second run makes no changes.

This document is maintained in `limix/overlay/CONTRIBUTING.md` and copied to the repository root by the existing overlay step. Keep both copies identical.

Record material decisions and validation results in `limix/docs/PROJECT_MEMORY.md` and the relevant module plan. Cloud services and account synchronization remain disabled unless the project owner explicitly authorizes activation.

## Pull requests

Describe the problem, resulting behavior, validation commands/results and material limitations. Include a reproduction or linked issue when available. Keep the title and description about the final change. Do not include credentials, personal customer data or generated build artifacts.

Changes to account access, tool execution, shared workspaces and backups must preserve existing authorization checks. Report security-sensitive issues privately using [SECURITY.md](SECURITY.md).

## Desktop builds and releases

Limix Bot targets Windows x64, macOS Apple Silicon, macOS Intel and Linux x64. Platform builds use native runners; macOS builds require the corresponding Apple development tools.

```sh
pnpm package:win
pnpm package:mac
pnpm package:linux
```

Release builds use [Limix Bot Desktop](.github/workflows/limix-desktop.yml), which coordinates platform packaging, packaged-server checks and updater-feed verification before publication. Keep the version aligned across all desktop targets. A completed workflow is not evidence that a real installed client has downloaded and applied an update.

Until signing and notarization are configured and verified, disclose those limitations in release notes. Do not publish from a feature branch or change release destinations without the project owner's authorization.

## License

Contributions are provided under the [Apache License 2.0](LICENSE). Preserve applicable notices in [NOTICE](NOTICE) and third-party license files.
