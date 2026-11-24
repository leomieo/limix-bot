"""Limix Bot Factory local CLI. No production modifications or external calls."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from .core import catalog, load_template, read_json, template_names, validate_spec
from .engine import canonical_json, evaluate, export_botpack, make_draft, migrate_legacy_spec, plan, save_draft
from .hybrid import check_skill, create_skill, hybrid_policy, pack_skill
from .policy import decide


def out(value: object) -> None:
    sys.stdout.write(canonical_json(value).decode("utf-8"))


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="limix-factory", description="Local BotSpec tooling. Dry-run only; no live Limix deployment.")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("catalog", help="Show supported capability names (not runtime binding status)")
    sub.add_parser("skill-policy", help="Show the required Hybrid Skills policy")
    init_skill = sub.add_parser("skill-init", help="Generate a Hybrid Skill (English Core and Vietnamese Layer)")
    init_skill.add_argument("--slug", required=True)
    init_skill.add_argument("--name-en", required=True)
    init_skill.add_argument("--description-en", required=True)
    init_skill.add_argument("--vi-title", required=True)
    init_skill.add_argument("--vi-summary", required=True)
    init_skill.add_argument("--out-dir", type=Path, required=True)
    check_skill_p = sub.add_parser("skill-check", help="Check Hybrid Skill structure and language boundaries")
    check_skill_p.add_argument("--path", type=Path, required=True)
    pack_skill_p = sub.add_parser("skill-pack", help="Package a checked Hybrid Skill ZIP; no deployment")
    pack_skill_p.add_argument("--path", type=Path, required=True)
    pack_skill_p.add_argument("--out", type=Path, required=True)
    pack_skill_p.add_argument("--force", action="store_true")
    migrate = sub.add_parser("migrate-v1", help="Upgrade legacy draft BotSpec 1.0 to Hybrid Skills v1.1")
    migrate.add_argument("--spec", type=Path, required=True)
    migrate.add_argument("--out", type=Path, required=True)
    sub.add_parser("templates", help="List the bundled example templates")
    p_show = sub.add_parser("show-template", help="Show one full template")
    p_show.add_argument("name")
    p_draft = sub.add_parser("draft", help="Create a validated BotSpec draft from a template")
    p_draft.add_argument("--template", required=True)
    p_draft.add_argument("--id", required=True)
    p_draft.add_argument("--tenant", required=True)
    p_draft.add_argument("--name", required=True)
    p_draft.add_argument("--requirements", default="", help="Raw user description; an AI agent must still refine BotSpec")
    p_draft.add_argument("--requirements-file", type=Path)
    p_draft.add_argument("--channel", action="append", dest="channels", help="Override template channels, repeatable")
    p_draft.add_argument("--out", type=Path, required=True)
    p_draft.add_argument("--force", action="store_true")
    for cmd in ("validate", "plan", "evaluate"):
        child = sub.add_parser(cmd)
        child.add_argument("--spec", type=Path, required=True)
    p_policy = sub.add_parser("simulate-policy", help="Static policy simulation; NOT live authorization")
    p_policy.add_argument("--spec", type=Path, required=True)
    p_policy.add_argument("--tool", required=True)
    p_policy.add_argument("--actor-tenant", required=True)
    p_policy.add_argument("--verified", action="store_true")
    p_policy.add_argument("--approved", action="store_true")
    p_pack = sub.add_parser("pack", help="Export local draft-only botpack")
    p_pack.add_argument("--spec", type=Path, required=True)
    p_pack.add_argument("--out", type=Path, required=True)
    p_pack.add_argument("--force", action="store_true")
    return p


def run(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "catalog":
            out(catalog())
        elif args.command == "skill-policy":
            out(hybrid_policy())
        elif args.command == "skill-init":
            path = create_skill(args.slug, args.name_en, args.description_en,
                                args.vi_title, args.vi_summary, args.out_dir)
            out({"created": str(path), "valid": True, "scope": "local_structural_only"})
        elif args.command == "skill-check":
            errors = check_skill(args.path)
            out({"valid": not errors, "errors": errors, "scope": "structural_not_semantic"})
            return 0 if not errors else 2
        elif args.command == "skill-pack":
            path = pack_skill(args.path, args.out, args.force)
            out({"created": str(path), "status": "unapproved_local_skill_only"})
        elif args.command == "migrate-v1":
            updated = migrate_legacy_spec(read_json(args.spec))
            save_draft(updated, args.out)
            out({"created": str(args.out), "schema_version": "1.1", "status": "draft"})
        elif args.command == "templates":
            out({"templates": template_names()})
        elif args.command == "show-template":
            out(load_template(args.name))
        elif args.command == "draft":
            description = args.requirements
            if args.requirements_file is not None:
                description = args.requirements_file.read_text(encoding="utf-8")
            draft = make_draft(args.template, args.id, args.tenant, args.name, description, args.channels)
            save_draft(draft, args.out, args.force)
            out({"created": str(args.out), "status": "draft", "deployment_ready": False})
        elif args.command == "validate":
            errors = validate_spec(read_json(args.spec))
            out({"valid": not errors, "errors": errors})
            return 0 if not errors else 2
        elif args.command == "plan":
            result = plan(read_json(args.spec))
            out(result)
            return 0 if result["valid"] else 2
        elif args.command == "evaluate":
            result = evaluate(read_json(args.spec))
            out(result)
            return 0 if result["passed"] else 2
        elif args.command == "simulate-policy":
            out(decide(read_json(args.spec), args.tool, args.actor_tenant, args.verified, args.approved))
        elif args.command == "pack":
            path = export_botpack(read_json(args.spec), args.out, args.force)
            out({"created": str(path), "status": "draft_only", "deployment_ready": False})
        return 0
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        out({"error": str(exc), "command": args.command})
        return 1


def main() -> None:
    sys.exit(run())
