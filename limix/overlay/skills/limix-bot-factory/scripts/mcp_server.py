#!/usr/bin/env python3
"""Local-only MCP tools for draft generation; requires the optional MCP Python SDK."""
from __future__ import annotations

import os
from pathlib import Path

from factorylib.core import catalog, load_template, read_json, template_names, validate_spec, SLUG
from factorylib.engine import evaluate, make_draft, plan, save_draft
from factorylib.policy import decide
from factorylib.hybrid import check_skill, create_skill, hybrid_policy

try:
    from mcp.server import MCPServer  # MCP Python SDK v2
except ImportError:
    try:
        from mcp.server.fastmcp import FastMCP as MCPServer  # SDK v1
    except ImportError:
        from factorylib.stdio import StdioServer as MCPServer

mcp = MCPServer("Limix Bot Factory - Local Drafts Only")
WORKSPACE = Path(os.environ.get("LIMIX_FACTORY_WORKSPACE", "./limix-factory-workspace")).expanduser().resolve()


def _safe_path(tenant_id: str, bot_id: str) -> Path:
    if not SLUG.fullmatch(tenant_id) or not SLUG.fullmatch(bot_id):
        raise ValueError("Only safe tenant and bot slugs are accepted")
    path = (WORKSPACE / "drafts" / tenant_id / bot_id / "spec.json").resolve()
    if not path.is_relative_to(WORKSPACE):
        raise ValueError("Draft path is outside the authorized workspace")
    return path


def _safe_skill_path(slug: str) -> Path:
    if not SLUG.fullmatch(slug):
        raise ValueError("Only safe skill slugs are accepted")
    path = (WORKSPACE / "skills" / slug).resolve()
    if not path.is_relative_to(WORKSPACE):
        raise ValueError("Skill path is outside authorized workspace")
    return path


@mcp.tool()
def factory_hybrid_policy() -> dict:
    """Return the canonical English Core + Vietnamese Layer policy."""
    return hybrid_policy()


@mcp.tool()
def factory_create_hybrid_skill(slug: str, name_en: str, description_en: str,
                                vi_title: str, vi_summary: str) -> dict:
    """Create a local Hybrid Skill draft. No installation, permissions or deployment."""
    path = create_skill(slug, name_en, description_en, vi_title, vi_summary, _safe_skill_path(slug))
    return {"skill_path": str(path), "status": "unapproved_local_draft"}


@mcp.tool()
def factory_check_hybrid_skill(slug: str) -> dict:
    """Statically check a generated Hybrid Skill. Not semantic security review."""
    errors = check_skill(_safe_skill_path(slug))
    return {"valid": not errors, "errors": errors, "scope": "structural_not_semantic"}


@mcp.tool()
def factory_templates() -> dict:
    """List the reusable Bot Templates available to an authoring agent."""
    return {"templates": template_names()}


@mcp.tool()
def factory_capabilities() -> dict:
    """Return declared channels/tools. This does not prove real Limix runtime integration."""
    return catalog()


@mcp.tool()
def factory_create_draft(template: str, bot_id: str, tenant_id: str,
                         display_name: str, requirements: str) -> dict:
    """Create a local, unprivileged draft from a vetted template; never deploy."""
    spec = make_draft(template, bot_id, tenant_id, display_name, requirements)
    path = _safe_path(tenant_id, bot_id)
    save_draft(spec, path)
    return {"draft_path": str(path), "status": "draft_only"}


@mcp.tool()
def factory_validate_draft(tenant_id: str, bot_id: str) -> dict:
    """Validate a locally created BotSpec draft."""
    spec = read_json(_safe_path(tenant_id, bot_id))
    errors = validate_spec(spec)
    return {"valid": not errors, "errors": errors}


@mcp.tool()
def factory_plan_draft(tenant_id: str, bot_id: str) -> dict:
    """Preview capability gaps and deployment blockers without touching the app."""
    return plan(read_json(_safe_path(tenant_id, bot_id)))


@mcp.tool()
def factory_evaluate_draft(tenant_id: str, bot_id: str) -> dict:
    """Run local static policy checks; not a production security evaluation."""
    return evaluate(read_json(_safe_path(tenant_id, bot_id)))


@mcp.tool()
def factory_simulate_tool(tenant_id: str, bot_id: str, tool_name: str,
                          actor_tenant: str, identity_verified: bool = False,
                          human_approved: bool = False) -> dict:
    """Simulate tool policy; all supplied identity flags are test inputs, not trusted auth."""
    spec = read_json(_safe_path(tenant_id, bot_id))
    return decide(spec, tool_name, actor_tenant, identity_verified, human_approved)


if __name__ == "__main__":
    # Keep stdout reserved for JSON-RPC, including for MCP clients using stdio.
    mcp.run(transport="stdio")
