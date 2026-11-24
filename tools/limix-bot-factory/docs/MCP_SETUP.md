# Optional local MCP setup for Codex CLI and Claude Code

MCP is optional. The standalone CLI + SKILL.md already support template authoring. Use MCP when you want tools to appear directly in the coding agent's tool list.

The official MCP Python SDK v2 uses `MCPServer`; the bundled script attempts the v2 import first, then the v1-compatible `FastMCP` import if necessary. The MCP server exports **local draft-only** operations and does not talk to a running Limix Bot installation.

## Install dependency

In the Python environment used by the coding agent:

```powershell
python -m pip install "mcp>=2,<3"
```

Check the installed SDK version and host compatibility. For deterministic deployments, pin an exact tested SDK version in your own lockfile.

## Configure Codex CLI (PowerShell)

Replace `C:\path\to\...` with the actual extracted or installed skill path. Use absolute paths for reliability.

```powershell
codex mcp add limix-bot-factory --env LIMIX_FACTORY_WORKSPACE=C:\limix-factory-workspace -- python "C:\path\to\limix-bot-factory\skills\limix-bot-factory\scripts\mcp_server.py"
codex mcp list
```

Alternatively, configure project-scoped `.codex/config.toml` in a trusted local repository:

```toml
[mcp_servers.limix-bot-factory]
command = "python"
args = ["C:/absolute/path/skills/limix-bot-factory/scripts/mcp_server.py"]
env = { LIMIX_FACTORY_WORKSPACE = "C:/limix-factory-workspace" }
```

## Configure Claude Code (PowerShell)

```powershell
claude mcp add --transport stdio --scope project --env LIMIX_FACTORY_WORKSPACE=C:\limix-factory-workspace limix-bot-factory -- python "C:\path\to\limix-bot-factory\skills\limix-bot-factory\scripts\mcp_server.py"
claude mcp list
```

Or create a trusted `.mcp.json` in your project (adjust absolute paths):

```json
{
  "mcpServers": {
    "limix-bot-factory": {
      "type": "stdio",
      "command": "python",
      "args": ["C:/absolute/path/skills/limix-bot-factory/scripts/mcp_server.py"],
      "env": {"LIMIX_FACTORY_WORKSPACE": "C:/limix-factory-workspace"}
    }
  }
}
```

**Do not commit local paths containing private usernames, tokens or credentials.** The above are examples, not automatically installed configurations.

## Available MCP tools

- `factory_hybrid_policy` - show the mandatory English Core + Vietnamese Layer contract
- `factory_create_hybrid_skill` - generate a local, unapproved bilingual Skill skeleton in the constrained workspace
- `factory_check_hybrid_skill` - check structure and layer markers; not semantic validation
- `factory_templates` - list templates
- `factory_capabilities` - list declarative tools and channels
- `factory_create_draft` - create a new local draft under a constrained workspace
- `factory_validate_draft` - validate draft shape and policy
- `factory_plan_draft` - inspect missing runtime bindings
- `factory_evaluate_draft` - static policy checks
- `factory_simulate_tool` - dry-run policy decision with test flags

No MCP tool publishes a bot, installs a Skill, grants permissions or modifies the Limix Bot runtime. Generated skills must be reviewed for semantic conflicts before approval.

## Security caveat

This is a local developer tool. Do not host as a public multi-tenant API. The tenant string in a test call is not authenticated identity. When integrating into Limix Bot, authenticated backend identity and enforced tool permissions are mandatory.
