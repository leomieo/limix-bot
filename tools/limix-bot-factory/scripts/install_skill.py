#!/usr/bin/env python3
"""Install a COPY of the skill into an existing repository (Codex and/or Claude)."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[3] / "skills" / "limix-bot-factory"
DESTINATIONS = {"codex": Path(".agents/skills"), "claude": Path(".claude/skills")}


def install(target: Path, agent: str, force: bool = False) -> list[Path]:
    target = Path(target).expanduser().resolve()
    if not target.is_dir():
        raise ValueError(f"Target repository directory not found: {target}")
    if not SOURCE.joinpath("SKILL.md").exists():
        raise ValueError("Source skill not found")
    names = [agent] if agent != "both" else ["codex", "claude"]
    locations = [target / DESTINATIONS[name] / "limix-bot-factory" for name in names]
    if not force:
        existing = [str(p) for p in locations if p.exists()]
        if existing:
            raise FileExistsError("Will not overwrite existing skills: " + ", ".join(existing))
    for dest in locations:
        if dest.exists():
            shutil.rmtree(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(SOURCE, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    return locations


def main() -> None:
    parser = argparse.ArgumentParser(description="Install Limix Bot Factory skill into an EXISTING project")
    parser.add_argument("--target", type=Path, required=True)
    parser.add_argument("--agent", choices=["codex", "claude", "both"], default="both")
    parser.add_argument("--force", action="store_true", help="Replace existing installed skills")
    args = parser.parse_args()
    try:
        for path in install(args.target, args.agent, args.force):
            print("Installed:", path)
    except (OSError, ValueError) as exc:
        parser.exit(1, f"ERROR: {exc}\n")


if __name__ == "__main__":
    main()
