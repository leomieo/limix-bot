"""Template generation, dry-run evaluation and offline botpack export."""
from __future__ import annotations

import copy
import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .core import catalog, load_template, read_json, validate_spec
from .policy import decide
from .hybrid import hybrid_policy


def canonical_json(obj: Any) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")


def make_draft(template: str, bot_id: str, tenant_id: str, display_name: str,
               requirements: str, channels: list[str] | None = None) -> dict[str, Any]:
    spec = copy.deepcopy(load_template(template))
    spec["id"] = bot_id
    spec["tenant_id"] = tenant_id
    spec["display_name"] = display_name
    if requirements.strip():
        spec["summary"] = requirements.strip()
    if channels is not None:
        spec["channels"] = [{"kind": channel, "credential_ref": None} for channel in channels]
    errors = validate_spec(spec)
    if errors:
        raise ValueError("Invalid draft: " + "; ".join(errors))
    return spec


def save_draft(spec: dict[str, Any], path: Path, force: bool = False) -> Path:
    errors = validate_spec(spec)
    if errors:
        raise ValueError("Invalid draft: " + "; ".join(errors))
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        raise FileExistsError(f"Refusing to overwrite draft: {path}")
    mode = "wb" if force else "xb"
    with path.open(mode) as fh:
        fh.write(canonical_json(spec))
    return path


def plan(spec: dict[str, Any]) -> dict[str, Any]:
    errors = validate_spec(spec)
    if errors:
        return {"valid": False, "errors": errors, "deployment_ready": False}
    caps = catalog()
    required = [{"type": "channel", "name": c["kind"], "credential_ref_set": bool(c["credential_ref"]), "binding": "unverified"} for c in spec["channels"]]
    required += [{"type": "tool", "name": t["name"], "binding": "unverified", "human_approval": t["approval"] == "human"} for t in spec["tools"]]
    required += [{"type": "knowledge", "name": c, "binding": "unverified"} for c in spec["knowledge"]["collections"]]
    return {
        "valid": True,
        "template_id": spec["template_id"],
        "template_version": spec["template_version"],
        "errors": [],
        "bot_id": spec["id"],
        "tenant_id": spec["tenant_id"],
        "requested_capabilities": required,
        "skills_policy": spec["skills_policy"],
        "checks": {
            "known_tools": all(t["name"] in caps["tools"] for t in spec["tools"]),
            "known_channels": all(c["kind"] in caps["channels"] for c in spec["channels"]),
            "draft_only": spec["lifecycle"]["status"] == "draft",
            "hybrid_skills_enforced": spec["skills_policy"] == hybrid_policy(),
        },
        "deployment_ready": False,
        "deployment_blockers": ["Limix runtime adapter and owner approval are not configured or verified."],
        "note": "A structural plan is not evidence of a live Limix Bot integration.",
    }


def evaluate(spec: dict[str, Any]) -> dict[str, Any]:
    """Static policy tests only. No LLM, channel, RAG, or runtime test is claimed."""
    errors = validate_spec(spec)
    if errors:
        return {"passed": False, "scope": "static_policy_only", "errors": errors, "cases": []}
    selected = [t["name"] for t in spec["tools"]]
    any_tool = selected[0] if selected else "knowledge.search"
    cases = [
        {"case": "deny_cross_tenant", "want": False, "actual": decide(spec, any_tool, "other-tenant")["allowed"]},
        {"case": "deny_non_allowlisted_shell", "want": False, "actual": decide(spec, "terminal.exec", spec["tenant_id"])["allowed"]},
        {"case": "deny_unapproved_sensitive_action", "want": False, "actual": decide(spec, "payments.refund", spec["tenant_id"])["allowed"]},
        {"case": "forbid_arbitrary_code", "want": False, "actual": spec["security"]["allow_arbitrary_code"]},
        {"case": "forbid_autonomous_publish", "want": False, "actual": spec["security"]["allow_autonomous_publish"]},
        {"case": "require_hybrid_skills", "want": True, "actual": spec["skills_policy"] == hybrid_policy()},
    ]
    for name in selected:
        descriptor = catalog()["tools"][name]
        if descriptor["requires_verified_identity"]:
            cases.append({"case": f"deny_unverified_identity:{name}", "want": False, "actual": decide(spec, name, spec["tenant_id"], identity_verified=False)["allowed"]})
        if descriptor["requires_human_approval"]:
            cases.append({"case": f"deny_unapproved_sensitive:{name}", "want": False, "actual": decide(spec, name, spec["tenant_id"], identity_verified=True, human_approved=False)["allowed"]})
    for c in cases:
        c["passed"] = c["want"] == c["actual"]
    return {"scope": "static_policy_only", "passed": all(c["passed"] for c in cases), "count": len(cases), "cases": cases,
            "not_tested": ["live backend auth", "LLM response quality", "prompt injection resilience", "RAG accuracy", "channel delivery", "production recovery"]}


def export_botpack(spec: dict[str, Any], output: Path, force: bool = False) -> Path:
    errors = validate_spec(spec)
    if errors:
        raise ValueError("Invalid BotSpec: " + "; ".join(errors))
    report = evaluate(spec)
    if not report["passed"]:
        raise ValueError("Static policy evaluation failed")
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and not force:
        raise FileExistsError(f"Refusing to overwrite botpack: {output}")
    payloads = {
        "spec.json": canonical_json(spec),
        "plan.json": canonical_json(plan(spec)),
        "evaluation.json": canonical_json(report),
    }
    manifest = {"format": "limix-botpack/v1", "created_at": datetime.now(timezone.utc).isoformat(),
                "bot_id": spec["id"], "tenant_id": spec["tenant_id"], "template_id": spec["template_id"],
                "template_version": spec["template_version"], "status": "draft_only",
                "skills_format": spec["skills_policy"]["format"],
                "sha256": {name: hashlib.sha256(data).hexdigest() for name, data in payloads.items()},
                "warning": "This package is not signed or approved for runtime deployment."}
    payloads["manifest.json"] = canonical_json(manifest)
    mode = "w" if force else "x"
    with zipfile.ZipFile(output, mode=mode, compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in payloads.items():
            archive.writestr(name, data)
    return output


def migrate_legacy_spec(spec: dict[str, Any]) -> dict[str, Any]:
    """Explicitly migrate an old draft from v1.0 without touching production state."""
    if spec.get('schema_version') != '1.0' or 'skills_policy' in spec:
        raise ValueError('Only legacy 1.0 BotSpec without skills_policy can be migrated')
    upgraded = copy.deepcopy(spec)
    upgraded['schema_version'] = '1.1'
    upgraded['skills_policy'] = hybrid_policy()
    errors = validate_spec(upgraded)
    if errors:
        raise ValueError('Legacy BotSpec cannot be migrated: ' + '; '.join(errors))
    return upgraded
