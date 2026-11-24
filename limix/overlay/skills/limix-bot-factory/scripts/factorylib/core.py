"""BotSpec loading and conservative policy validation (Python standard library)."""
from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
TEMPLATES = ASSETS / "templates"
SCHEMA = ASSETS / "schemas" / "bot-spec.schema.json"
SLUG = re.compile(r"^[a-z][a-z0-9-]{1,47}$")
COLLECTION = re.compile(r"^[a-z][a-z0-9_.-]{0,63}$")
CRED_REF = re.compile(r"^cred:[a-z][a-z0-9_.-]{0,79}$")
SECRET_NAMES = {"api_key", "apikey", "access_token", "refresh_token", "bot_token", "password", "client_secret", "private_key", "authorization", "secret", "credentials"}
FIELDS = {
    "root": {"schema_version", "template_id", "template_version", "id", "display_name", "tenant_id", "summary", "persona", "channels", "knowledge", "tools", "model", "limits", "security", "lifecycle", "skills_policy"},
    "persona": {"role", "language", "style"},
    "channel": {"kind", "credential_ref"},
    "knowledge": {"collections", "require_citations"},
    "tool": {"name", "approval"},
    "model": {"tier", "fallback_tier", "max_context_tokens"},
    "limits": {"max_steps", "max_tool_calls", "timeout_seconds", "max_output_tokens", "max_cost_usd"},
    "security": {"require_verified_identity", "memory_scope", "allow_arbitrary_code", "allow_autonomous_publish"},
    "lifecycle": {"status"},
}


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise ValueError(f"Duplicate JSON key: {key}")
        out[key] = value
    return out


def read_json(path: Path) -> Any:
    path = Path(path)
    if path.stat().st_size > 1024 * 1024:
        raise ValueError("JSON file exceeds 1 MiB safety limit")
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh, object_pairs_hook=_reject_duplicates)


def catalog() -> dict[str, Any]:
    return read_json(ASSETS / "capabilities.json")


def template_names() -> list[str]:
    return sorted(path.stem for path in TEMPLATES.glob("*.json") if SLUG.fullmatch(path.stem))


def load_template(name: str) -> dict[str, Any]:
    if not SLUG.fullmatch(name) or name not in template_names():
        raise ValueError(f"Unknown template: {name}")
    result = read_json(TEMPLATES / f"{name}.json")
    errors = validate_spec(result)
    if errors:
        raise ValueError(f"Template {name} invalid: {'; '.join(errors)}")
    return copy.deepcopy(result)


def validate_spec(spec: Any) -> list[str]:
    """Strict semantic validation. This does not check deployed runtime integrations."""
    errors: list[str] = []
    available = catalog()

    def obj(value: Any, where: str, fields: set[str]) -> bool:
        if not isinstance(value, dict):
            errors.append(f"{where} must be an object")
            return False
        extras = set(value) - fields
        missing = fields - set(value)
        if extras:
            errors.append(f"{where} has unknown fields: {', '.join(sorted(extras))}")
        if missing:
            errors.append(f"{where} is missing fields: {', '.join(sorted(missing))}")
        return not missing

    def string(value: Any, where: str, lo: int = 1, hi: int = 2000) -> None:
        if not isinstance(value, str) or not lo <= len(value.strip()) <= hi:
            errors.append(f"{where} must be a string of length {lo}..{hi}")

    def integer(value: Any, where: str, lo: int, hi: int) -> None:
        if type(value) is not int or not lo <= value <= hi:
            errors.append(f"{where} must be an integer in {lo}..{hi}")

    def boolean(value: Any, where: str) -> None:
        if type(value) is not bool:
            errors.append(f"{where} must be a boolean")

    if not obj(spec, "spec", FIELDS["root"]):
        return errors
    if spec.get("schema_version") != "1.1":
        errors.append("schema_version must be 1.1 (migrate legacy 1.0 drafts)")
    if not isinstance(spec.get("template_id"), str) or not SLUG.fullmatch(spec["template_id"]):
        errors.append("template_id must be a safe slug")
    if not isinstance(spec.get("template_version"), str) or not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", spec["template_version"]):
        errors.append("template_version must be semantic version x.y.z")
    for field in ("id", "tenant_id"):
        if not isinstance(spec.get(field), str) or not SLUG.fullmatch(spec[field]):
            errors.append(f"{field} must be a safe lowercase slug (2..48 characters)")
    string(spec.get("display_name"), "display_name", 2, 120)
    string(spec.get("summary"), "summary", 1, 2000)

    persona = spec.get("persona")
    if obj(persona, "persona", FIELDS["persona"]):
        string(persona.get("role"), "persona.role", 2, 600)
        if persona.get("language") not in ("vi", "en", "vi-en"):
            errors.append("persona.language must be vi, en, or vi-en")
        string(persona.get("style"), "persona.style", 2, 300)

    channels = spec.get("channels")
    if not isinstance(channels, list) or len(channels) > 8:
        errors.append("channels must be a list of up to 8 entries")
    else:
        seen: set[str] = set()
        for index, channel in enumerate(channels):
            where = f"channels[{index}]"
            if not obj(channel, where, FIELDS["channel"]):
                continue
            kind = channel.get("kind")
            if not isinstance(kind, str) or kind not in available["channels"]:
                errors.append(f"{where}.kind is not in capability catalog")
            if isinstance(kind, str) and kind in seen:
                errors.append(f"Duplicate channel: {kind}")
            if isinstance(kind, str):
                seen.add(kind)
            ref = channel.get("credential_ref")
            if ref is not None and (not isinstance(ref, str) or not CRED_REF.fullmatch(ref)):
                errors.append(f"{where}.credential_ref must be null or a cred: reference, not a secret")

    knowledge = spec.get("knowledge")
    if obj(knowledge, "knowledge", FIELDS["knowledge"]):
        collections = knowledge.get("collections")
        if not isinstance(collections, list) or len(collections) > 24:
            errors.append("knowledge.collections must be a list of up to 24 slugs")
        else:
            if len(collections) != len(set(str(x) for x in collections)):
                errors.append("knowledge.collections contains duplicates")
            for item in collections:
                if not isinstance(item, str) or not COLLECTION.fullmatch(item):
                    errors.append("knowledge collection names must be safe slugs")
        boolean(knowledge.get("require_citations"), "knowledge.require_citations")

    tools = spec.get("tools")
    if not isinstance(tools, list) or len(tools) > 24:
        errors.append("tools must be a list of up to 24 entries")
    else:
        seen_tools: set[str] = set()
        for i, item in enumerate(tools):
            where = f"tools[{i}]"
            if not obj(item, where, FIELDS["tool"]):
                continue
            name = item.get("name")
            if not isinstance(name, str) or name not in available["tools"]:
                errors.append(f"{where}.name is not in the approved tool catalog")
                continue
            if name in seen_tools:
                errors.append(f"Duplicate tool: {name}")
            seen_tools.add(name)
            approval = item.get("approval")
            if approval not in ("none", "human"):
                errors.append(f"{where}.approval must be none or human")
            if available["tools"][name]["requires_human_approval"] and approval != "human":
                errors.append(f"{name} requires human approval")
            security = spec.get("security")
            identity_required = isinstance(security, dict) and security.get("require_verified_identity") is True
            if available["tools"][name]["requires_verified_identity"] and not identity_required:
                errors.append(f"{name} requires verified customer identity")

    model = spec.get("model")
    if obj(model, "model", FIELDS["model"]):
        for key in ("tier", "fallback_tier"):
            if model.get(key) is not None and (not isinstance(model.get(key), str) or model.get(key) not in available["model_tiers"]):
                errors.append(f"model.{key} is not in model_tiers")
        if model.get("tier") is None:
            errors.append("model.tier is required")
        integer(model.get("max_context_tokens"), "model.max_context_tokens", 512, 200000)

    limits = spec.get("limits")
    if obj(limits, "limits", FIELDS["limits"]):
        for field, lo, hi in (("max_steps", 1, 100), ("max_tool_calls", 0, 200), ("timeout_seconds", 5, 3600), ("max_output_tokens", 64, 64000)):
            integer(limits.get(field), f"limits.{field}", lo, hi)
        cost = limits.get("max_cost_usd")
        if isinstance(cost, bool) or not isinstance(cost, (int, float)) or not 0 < cost <= 100:
            errors.append("limits.max_cost_usd must be a positive number <= 100")

    sec = spec.get("security")
    if obj(sec, "security", FIELDS["security"]):
        boolean(sec.get("require_verified_identity"), "security.require_verified_identity")
        if sec.get("memory_scope") not in ("tenant_bot_customer", "tenant_bot"):
            errors.append("security.memory_scope must be tenant_bot_customer or tenant_bot")
        if sec.get("allow_arbitrary_code") is not False:
            errors.append("security.allow_arbitrary_code must be false")
        if sec.get("allow_autonomous_publish") is not False:
            errors.append("security.allow_autonomous_publish must be false")

    life = spec.get("lifecycle")
    if obj(life, "lifecycle", FIELDS["lifecycle"]):
        if life.get("status") != "draft":
            errors.append("Factory only accepts draft lifecycle status")

    def secret_scan(value: Any, path: str = "spec") -> None:
        if isinstance(value, dict):
            for key, item in value.items():
                if key.lower() in SECRET_NAMES:
                    errors.append(f"{path}.{key} must not contain a secret or credential")
                secret_scan(item, f"{path}.{key}")
        elif isinstance(value, list):
            for i, item in enumerate(value):
                secret_scan(item, f"{path}[{i}]")

    # Hybrid policy is mandatory for every newly created bot, regardless of reply language.
    from .hybrid import validate_policy
    errors.extend(validate_policy(spec.get("skills_policy")))
    secret_scan(spec)
    return errors
