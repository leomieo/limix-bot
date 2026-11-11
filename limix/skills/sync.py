#!/usr/bin/env python3
"""Vendors Limix Bot's default skills from GitHub (Leox ৹ Limix AI).

    python3 limix/skills/sync.py            # rebuild limix/overlay/skills/<id> from the pinned commits
    python3 limix/skills/sync.py --update   # move every skill to the newest commit of its ref, then rebuild

Each skill comes from limix/skills/sources.json: the upstream folder at the pinned commit, its licence (and NOTICE),
a Limix manifest.json (name, trigger terms, default on/off) and a short Limix preface in SKILL.md saying how to run it
on a Limix Bot computer (bundled Python and uv). After --update, review `git diff limix/` before releasing:
upstream skills can tell a bot to run commands on customers' computers.
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCES = HERE / "sources.json"
OUT = ROOT / "limix" / "overlay" / "skills"
SKIP_DIRS = {".git", "__pycache__", "tests", "test", "node_modules"}
SKIP_SUFFIXES = {".pyc"}

PREFACE = {
    "python": (
        "> **Limix Bot.** `python` (Python 3.12) is bundled with Limix Bot and on PATH (`python3` too); no install needed.\n"
        "> `<root>` below is the folder named by this skill's `root`. Quote it: it may contain spaces.\n"
    ),
    "uv": (
        "> **Limix Bot.** Python 3.12 and `uv` are bundled with Limix Bot and on PATH. If the command is missing, ask the\n"
        "> person once, then install it with:\n>\n> ```\n> {install}\n> ```\n>\n"
        "> Tools installed this way land in Limix Bot's own folder (no administrator rights needed) and are on PATH from the\n"
        "> next command. `<root>` is the folder named by this skill's `root`.\n"
    ),
}


def git(*args, cwd=None):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def checkout(repo, ref, commit, into):
    url = f"https://github.com/{repo}.git"
    git("init", "-q", str(into))
    git("remote", "add", "origin", url, cwd=into)
    target = commit or ref
    git("fetch", "-q", "--depth", "1", "origin", target, cwd=into)
    git("checkout", "-q", "FETCH_HEAD", cwd=into)
    return git("rev-parse", "HEAD", cwd=into)


def frontmatter_split(text):
    m = re.match(r"^---\n.*?\n---\n", text, re.S)
    if not m:
        raise SystemExit("skill file has no frontmatter")
    return text[: m.end()], text[m.end():]


def build(skill, src, commit):
    dest = OUT / skill["id"]
    if dest.exists():
        shutil.rmtree(dest)
    folder = src / skill["folder"]
    exclude = set(skill.get("exclude", []))
    for path in sorted(folder.rglob("*")):
        rel = path.relative_to(folder)
        if any(part in SKIP_DIRS for part in rel.parts) or path.suffix in SKIP_SUFFIXES or path.is_dir():
            continue
        if len(rel.parts) == 1 and rel.name in exclude:
            continue
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    text = (src / skill["skillFile"]).read_text(encoding="utf-8").replace("\r\n", "\n")
    for old, new in skill.get("rewrite", []):
        text = text.replace(old, new)
    head, body = frontmatter_split(text)
    head = head.replace('version: "{{VERSION}}"', f'version: "{commit[:7]}"')
    preface = PREFACE[skill["needs"]].format(install=skill.get("install", "").replace("{commit}", commit))
    source = f"> Source: https://github.com/{skill['repo']}/tree/{commit}/{skill['folder']} ({skill['license']}).\n"
    (dest / "SKILL.md").write_text(head + "\n" + preface + source + "\n" + body.lstrip("\n"), encoding="utf-8")
    shutil.copyfile(src / skill["licenseFile"], dest / "LICENSE")
    if skill.get("noticeFile"):
        shutil.copyfile(src / skill["noticeFile"], dest / "NOTICE")
    manifest = {
        "id": skill["id"],
        "name": skill["name"],
        "version": "1.0.0",
        "description": skill["description"],
        "defaultEnabled": skill["defaultEnabled"],
        "triggerTerms": skill["triggerTerms"],
        "requiredCapabilities": [],
        "source": {"repo": skill["repo"], "commit": commit, "folder": skill["folder"], "license": skill["license"]},
    }
    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return sum(1 for p in dest.rglob("*") if p.is_file())


def main():
    update = "--update" in sys.argv
    data = json.loads(SOURCES.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    for skill in data["skills"]:
        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / "src"
            commit = checkout(skill["repo"], skill["ref"], None if update else skill["commit"], src)
            if update and commit != skill["commit"]:
                print(f"{skill['id']}: {skill['commit'][:7]} -> {commit[:7]}")
                skill["commit"] = commit
            files = build(skill, src, commit)
            print(f"{skill['id']}: {files} files at {commit[:7]}")
    if update:
        SOURCES.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("Review `git diff limix/` before releasing.")


if __name__ == "__main__":
    main()
