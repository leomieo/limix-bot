"""Deterministic simulated tool policy; never a substitute for runtime authorization."""
from __future__ import annotations

from typing import Any
from .core import catalog, validate_spec


def decide(spec: dict[str, Any], tool_name: str, actor_tenant: str,
           identity_verified: bool = False, human_approved: bool = False) -> dict[str, Any]:
    errors = validate_spec(spec)
    if errors:
        return {"allowed": False, "reason": "invalid_spec", "errors": errors}
    if actor_tenant != spec["tenant_id"]:
        return {"allowed": False, "reason": "tenant_mismatch"}
    requested = {tool["name"]: tool for tool in spec["tools"]}
    if tool_name not in requested:
        return {"allowed": False, "reason": "tool_not_allowlisted"}
    descriptor = catalog()["tools"][tool_name]
    if descriptor["requires_verified_identity"] and not identity_verified:
        return {"allowed": False, "reason": "identity_required"}
    if (descriptor["requires_human_approval"] or requested[tool_name]["approval"] == "human") and not human_approved:
        return {"allowed": False, "reason": "human_approval_required"}
    return {"allowed": True, "reason": "policy_simulation_passed"}
