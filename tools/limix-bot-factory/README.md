The runtime skill and CLI are shipped at `../../skills/limix-bot-factory/` relative to this directory. Run the standalone commands below from the Limix Bot repository root.

# Limix Bot Factory - Hybrid Skills Bot Template Toolkit

A standalone, local-first Bot Template authoring toolkit for use with **Codex CLI, Claude Code, and filesystem-capable coding agents** while integrating with an **existing Limix Bot application**. No new GitHub remote is required to begin.

## What works now

- One portable `limix-bot-factory` skill (`SKILL.md`, references, templates and scripts).
- 7 initial bot templates with Vietnamese gallery metadata.
- BotSpec 1.1 JSON schema with mandatory **Hybrid Skills (English Core + Vietnamese Layer)** contract and strict Python validation.
- Local CLI to list templates, create draft, preview capabilities, simulate policy, evaluate static rules and export a draft-only BotPack.
- Optional MCP stdio tool server using the official MCP Python SDK, with local workspace confinement for draft storage.
- Installer for Codex and Claude Code project skill paths.
- Hybrid Skill scaffold, structural linter, and local ZIP packer; optional MCP tools for skill creation/validation.
- Explicit migration for legacy draft BotSpec 1.0 files.
- Unit tests and continuous integration workflow.

## What is NOT included

No direct connection to your Limix Bot repository, bots database, channels, LLM providers, credential vault or production runtime. Declared tools/channels are reference names and remain **unverified** until an adapter is implemented in the real project. No publish or production deployment tool is included.

## Mandatory Hybrid Skills standard

Every new bot template must declare the canonical `skills_policy` defined in `skills/limix-bot-factory/assets/hybrid-policy.json`. Every new/generated Skill uses:

- `SKILL.md`: **English Core**, canonical instructions, tool names, safety boundaries, and workflow.
- `references/vi.md`: **Vietnamese Layer**, Vietnamese user explanations and examples, never a source of elevated permissions.
- `assets/hybrid-policy.json`: exact contract and language precedence.

Never translate API names, CLI flags, schema keys or tool identifiers. Load Vietnamese documentation only when needed; use Vietnamese naturally in the bot interface. On any mismatch, English Core + backend policy prevail, and flag the Vietnamese layer for review. `skill-check` is a *structural* linter, not a semantic security test.

Create an example skill:

```powershell
python skills/limix-bot-factory/scripts/bot_factory.py skill-init --slug shop-helper --name-en "Shop Helper" --description-en "Help users with verified store FAQs and route uncertain requests to staff" --vi-title "Trợ lý cửa hàng" --vi-summary "Hỗ trợ tư vấn theo dữ liệu cửa hàng đã xác minh" --out-dir ./generated-skills/shop-helper
python skills/limix-bot-factory/scripts/bot_factory.py skill-check --path ./generated-skills/shop-helper
python skills/limix-bot-factory/scripts/bot_factory.py skill-pack --path ./generated-skills/shop-helper --out ./generated-skills/shop-helper.zip
```

This creates a non-authorized local skill draft, **not** a production bot. Before approving a skill, compare both language layers semantically and scan bundled scripts/dependencies for safety.

## Requirements

- Python 3.11+ for CLI and unit tests (no third-party Python packages required).
- Optional MCP server: official `mcp` Python SDK, with a version supported by your host.
- A local Codex/Claude installation if you want the agent to interpret business descriptions.

## Quick start (Windows PowerShell)

From the extracted repository root:

```powershell
python scripts/install_skill.py --target "F:\PATH\TO\Limix Bot" --agent both
python skills/limix-bot-factory/scripts/bot_factory.py templates
python skills/limix-bot-factory/scripts/bot_factory.py draft --template customer-support --id shop-support --tenant demo-shop --name "Shop Support" --requirements "Help customers with FAQ" --out ./drafts/shop-support.json
python skills/limix-bot-factory/scripts/bot_factory.py validate --spec ./drafts/shop-support.json
python skills/limix-bot-factory/scripts/bot_factory.py plan --spec ./drafts/shop-support.json
python skills/limix-bot-factory/scripts/bot_factory.py evaluate --spec ./drafts/shop-support.json
python skills/limix-bot-factory/scripts/bot_factory.py pack --spec ./drafts/shop-support.json --out ./drafts/shop-support.botpack.zip
```

Replace the placeholder path with the ACTUAL root of the Limix Bot repository. The previously discussed paths for other apps are not assumed to be Limix Bot's path. The `draft` CLI records user text but does not call an LLM; your coding agent must refine the structured spec from that description.

## Install to an existing project

```powershell
python scripts/install_skill.py --target "C:\path\to\existing-limix-bot" --agent codex
python scripts/install_skill.py --target "C:\path\to\existing-limix-bot" --agent claude
```

This installs to `.agents/skills/limix-bot-factory` and/or `.claude/skills/limix-bot-factory`. The installer refuses to overwrite existing skill folders unless explicitly given `--force`. Run Codex/Claude from the actual repository and request `limix-bot-factory` for Bot Template work.

## Optional MCP integration

First install the official SDK in your chosen Python environment:

```bash
python -m pip install "mcp>=2,<3"
```

Then configure a local stdio server that runs:

```bash
python /ABSOLUTE/PATH/TO/skills/limix-bot-factory/scripts/mcp_server.py
```

With environment variable `LIMIX_FACTORY_WORKSPACE` set to a local workspace directory you control. Consult your agent's MCP configuration format for its installed version. Do not expose this unauthenticated developer-local MCP server to the Internet.

## Architecture and integration

Read `docs/INTEGRATE_WITH_LIMIX.md` and `docs/MCP_SETUP.md`. The target integration is **Bot Template cards and a create-from-template flow within the existing Limix Bot app**, using its actual bots, auth, data and worker APIs. The existing repository must be inspected before writing integration code.

## Run tests

```bash
python -m unittest discover -s tests -v
python /home/oai/skills/skill-creator/scripts/quick_validate.py skills/limix-bot-factory
```

The second command is optional and specific to environments that have the skill creator validator. The first is portable.

## Legacy draft migration

Existing BotSpec 1.0 drafts from the previous distribution can be explicitly upgraded without modifying production data:

```powershell
python skills/limix-bot-factory/scripts/bot_factory.py migrate-v1 --spec ./drafts/old.json --out ./drafts/new-hybrid.json
```

Validate the migrated output before packing. A `BotSpec` with no `skills_policy` is rejected for new exports.

## GitHub repository later

Recommended repo name: `limix-bot-factory`. Create it when you want versioning, team review, CI and distribution; it is not required for local integration. Do not commit credentials, tenant data, real conversation history or environment files.
