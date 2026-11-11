#!/usr/bin/env python3
"""Turns an OpenMausBot checkout into Limix Bot (Leox ৹ Limix AI).

Usage: python3 rebrand.py <openmausbot-checkout> <brand-assets-dir>

Idempotent: running it twice gives the same tree. It changes only what a person sees or what must
differ so Limix Bot and OpenMausBot can live on one computer; internal identifiers stay put so
upstream updates keep merging. Trademarks: the OpenMausBot/MausBot names and the cursor mascot are
Supamaus trademarks (LICENSING.md), so all three are replaced. enterprise/ (separate licence) is removed.
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
ASSETS = Path(sys.argv[2]).resolve()

NAME = "Limix Bot"
AUTHOR = "Leox ৹ Limix AI"
OWNER, REPO = "leomieo", "limix-bot"
REPO_URL = f"https://github.com/{OWNER}/{REPO}"
APP_ID = "com.limixai.limixbot"

changed = []


def edit(rel, fn):
    p = ROOT / rel
    old = p.read_text(encoding="utf-8")
    new = fn(old)
    if new != old:
        p.write_text(new, encoding="utf-8")
        changed.append(rel)


def must(text, old, new):
    if new in text and old not in text:
        return text
    if old not in text:
        raise SystemExit(f"rebrand: pattern not found: {old[:80]!r}")
    return text.replace(old, new)


# 1. Licence boundary.
if (ROOT / "enterprise").exists():
    shutil.rmtree(ROOT / "enterprise")
    changed.append("enterprise/ (removed)")
edit("tsconfig.server.json", lambda s: s.replace('    "enterprise",\n', ""))

# 2. Package and installer identity.
def package_json(s):
    d = json.loads(s)
    d["name"] = "limixbot"
    d["description"] = "Limix Bot: a local-first chat app for running a team of AI bots, connected to Telegram and Zalo."
    d["homepage"] = REPO_URL
    d["repository"] = {"type": "git", "url": f"{REPO_URL}.git"}
    d["author"] = {"name": AUTHOR}
    d["desktopName"] = f"{APP_ID}.desktop"
    return json.dumps(d, indent=2, ensure_ascii=False) + "\n"
edit("package.json", package_json)

def builder(s):
    s = re.sub(r"^appId: .*$", f"appId: {APP_ID}", s, flags=re.M)
    s = re.sub(r"^productName: .*$", f"productName: {NAME}", s, flags=re.M)
    s = re.sub(r"^artifactName: .*$", "artifactName: LimixBot-${version}-${arch}.${ext}", s, flags=re.M)
    if not re.search(r"^copyright: ", s, flags=re.M):
        s = s.replace(f"productName: {NAME}\n", f"productName: {NAME}\ncopyright: Copyright © 2026 {AUTHOR}\n", 1)
    # The openmausbot:// scheme stays: electron/ registers and parses that exact scheme at runtime.
    s = s.replace("  - name: Limix Bot package install\n    schemes: [limixbot]", "  - name: OpenMausBot package install\n    schemes: [openmausbot]")
    s = re.sub(r"(publish:\n  - provider: github\n    owner: )\S+(\n    repo: )\S+", rf"\g<1>{OWNER}\g<2>{REPO}", s)
    s = re.sub(r"^  shortcutName: .*$", f"  shortcutName: {NAME}", s, flags=re.M)
    s = re.sub(r"^  artifactName: OpenMausBot-\$\{version\}-setup\.\$\{ext\}$", "  artifactName: LimixBot-${version}-setup.${ext}", s, flags=re.M)
    return s
edit("electron-builder.yml", builder)

# 2b. Build on GitHub: only Limix Bot's own Windows workflow runs in the fork.
wf = ROOT / ".github/workflows"
if wf.exists():
    for f in wf.glob("*.yml"):
        if f.name not in ("limix-windows.yml", "limix-npm.yml"):
            f.unlink()
            changed.append(f".github/workflows/{f.name} (removed)")
shutil.copy(ASSETS / "limix-windows.yml", wf / "limix-windows.yml")
shutil.copy(ASSETS / "limix-npm.yml", wf / "limix-npm.yml")

# 2c. The command-line package is published as `limixbot` (npx limixbot pair). The bundle keeps its file name.
def npm_package(s):
    s = s.replace("https://github.com/milind-soni/OpenMausBot.git", f"{REPO_URL}.git")
    s = s.replace("https://github.com/milind-soni/OpenMausBot#readme", f"{REPO_URL}#readme")
    s = s.replace('"cli.js", "dist-server", "dist", "skills", "enterprise", "LICENSE", "README.md"', '"cli.js", "dist-server", "dist", "skills", "LICENSE", "README.md"')
    s = s.replace("openmausbot.js", "\0BUNDLE\0")
    s = re.sub(r"(?<![\w.-])openmausbot(?![\w-])", "limixbot", s)
    s = s.replace("\0BUNDLE\0", "openmausbot.js")
    s = re.sub(r"\bOpen ?Maus ?Bot\b|\bMausBot\b", NAME, s)
    s = s.replace('description: "Run the Limix Bot server anywhere and pair your devices to it"',
                  f'description: "Run the Limix Bot server anywhere and pair your devices to it ({AUTHOR})"')
    return s
edit("scripts/build-npm-package.mjs", npm_package)

# 3. Product name, links, data folder, hosted cloud offers.
edit("server/brand.ts", lambda s: must(s, 'export const DEFAULT_BRAND: Brand = { name: "OpenMausBot" };',
                                       f'export const DEFAULT_BRAND: Brand = {{ name: "{NAME}" }};'))
def app_links(s):
    s = must(s, 'export const APP_NAME = "OpenMausBot";', f'export const APP_NAME = "{NAME}";')
    return must(s, 'export const APP_REPOSITORY = "https://github.com/milind-soni/OpenMausBot";', f'export const APP_REPOSITORY = "{REPO_URL}";')
edit("src/lib/app-links.ts", app_links)
# Limix Bot keeps its own data so it never shares (or fights over) an OpenMausBot install's folder.
edit("server/config.ts", lambda s: must(s, 'join(dataHome(), ".openmausbot");', 'join(dataHome(), ".limixbot");'))
edit("electron/main.mjs", lambda s: must(s, 'path.join(app.getPath("home"), ".openmausbot");', 'path.join(app.getPath("home"), ".limixbot");'))
# MausBot Cloud is Supamaus's hosted service: Limix Bot does not offer it.
edit("electron/main.mjs", lambda s: must(s, "  return app.isPackaged && !desktopRemoteAccess && brandedBuild === false;", "  return false;"))
edit("electron/main.mjs", lambda s: s.replace('app.setDesktopName("com.openmausbot.app.desktop")', f'app.setDesktopName("{APP_ID}.desktop")'))
edit("index.html", lambda s: s.replace('content="OpenMausBot"', f'content="{NAME}"').replace("<title>MausBot</title>", f"<title>{NAME}</title>"))
def manifest(s):
    d = json.loads(s)
    d["name"] = NAME
    d["short_name"] = NAME
    return json.dumps(d, indent=2, ensure_ascii=False) + "\n"
edit("public/manifest.webmanifest", manifest)

# 4. Author and upstream attribution in the About dialog.
def about(s):
    line = f'        <p className="mt-2 text-[12px] text-ink-secondary">{AUTHOR} · Based on OpenMausBot (Apache-2.0)</p>\n'
    if AUTHOR in s:
        return s
    anchor = "        <div className=\"mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[13px]\">\n"
    return must(s, anchor, line + anchor)
edit("src/components/AboutDialog.tsx", about)

# 5. Words people read, and the data folders that carry the old name.
# Brand words in string literals, JSX text and locale values. A word touching a URL, path, file name or
# identifier stays (the lookarounds), so links, domains and internal ids keep working.
EDGE_L = r"(?<![\w./@:\\-])"
EDGE_R = r"(?![\w/\\])(?!\.[A-Za-z])(?! Speech)"
BRAND = [(re.compile(EDGE_L + pat + EDGE_R), to) for pat, to in (
    (r"OpenMaus ?[Bb]ot", NAME),
    (r"Maus ?Bot", NAME),
    (r"OpenMaus", "Limix"),
    (r"Maus", "Limix"),
)]
KEEP = re.compile(r"Apache-2\.0|Supamaus|trademark")
# Command lines shown to people: `openmausbot pair` and friends.
CLI = re.compile(r"\b(npx )?openmausbot (?=(?:serve|pair|browser|status|logout|login|setup|update|service|connect|doctor|backup|restore|version|help|install|unpair|start|stop)\b)")
# The data folders: ~/.openmausbot, ~/.openmausbot-secrets, ... but never a domain such as cloud.openmausbot.com.
DATA_DIR = re.compile(r"(?<![\w])\.openmausbot(?![\w])(?!\\?\.[a-z])")

def fix_text(text):
    if KEEP.search(text):
        return text
    for rx, to in BRAND:
        text = rx.sub(to, text)
    return CLI.sub(lambda m: (m.group(1) or "") + "limixbot ", text)

LITERAL = re.compile(r'"(?:[^"\\\n]|\\.)*"|\'(?:[^\'\\\n]|\\.)*\'|`(?:[^`\\]|\\.)*`')
JSX_TEXT = re.compile(r">([^<>{}]*)<")

def fix_code(s, jsx):
    s = LITERAL.sub(lambda m: fix_text(m.group(0)), s)
    if jsx:
        s = JSX_TEXT.sub(lambda m: ">" + fix_text(m.group(1)) + "<", s)
    return DATA_DIR.sub(".limixbot", s)

TEST = re.compile(r"\.(test|spec|e2e|node-test)\.|/test/|__tests__|/fixtures?/")
for folder in ("src", "server", "shared", "electron", "companion"):
    if not (ROOT / folder).exists():
        continue
    for p in sorted((ROOT / folder).rglob("*")):
        rel = p.relative_to(ROOT).as_posix()
        if not p.is_file() or TEST.search(rel) or p.suffix not in (".ts", ".tsx", ".mjs", ".cjs", ".js", ".html"):
            continue
        if "/locales/" in rel or "node_modules" in rel:
            continue
        edit(rel, lambda s, tsx=p.suffix == ".tsx": fix_code(s, tsx))

def fix_locale(s):
    d = json.loads(s)
    def walk(v):
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        if isinstance(v, list):
            return [walk(x) for x in v]
        return DATA_DIR.sub(".limixbot", fix_text(v)) if isinstance(v, str) else v
    return json.dumps(walk(d), indent=2, ensure_ascii=False) + "\n"
for p in sorted((ROOT / "src/locales").glob("*.json")):
    if p.name == "source-hashes.json":
        continue
    edit(p.relative_to(ROOT).as_posix(), fix_locale)

# 5b. Technical names the first passes broke: header names and markers must stay byte-identical to what the other
# side compares (the server reads x-openmausbot-desktop-owner), and user agents must not carry a space.
TECH = {
    '"X-Limix Bot-Desktop-Owner"': '"X-OpenMausBot-Desktop-Owner"',
    '"X-Limix Bot-Lending=true"': '"X-OpenMausBot-Lending=true"',
    '"Limix Bot-domain-check"': '"LimixBot-domain-check"',
    '"Limix Bot-skills"': '"LimixBot-skills"',
    '"Limix Bot-wait"': '"LimixBot-wait"',
    "`Limix Bot-${": "`LimixBot-${",
    'filename="Limix Bot-${': 'filename="LimixBot-${',
}
TECH_FILES = ["electron/desktop-server-auth.cjs", "electron/open-at-login.mjs", "server/custom-domain.ts", "server/skill-fetch.ts", "server/wait-probes.ts", "server/workspace-backup-http.ts"]
def tech(s):
    for old, new in TECH.items():
        s = s.replace(old, new)
    return s
for rel in TECH_FILES:
    edit(rel, tech)
LEFTOVER = re.compile(r"[\w-]Limix Bot|Limix Bot-[A-Z]")
for folder in ("src", "server", "shared", "electron", "companion"):
    for p in sorted((ROOT / folder).rglob("*")):
        if p.is_file() and p.suffix in (".ts", ".tsx", ".mjs", ".cjs", ".js") and not TEST.search(p.as_posix()) and "/locales/" not in p.as_posix():
            for line in p.read_text(encoding="utf-8").splitlines():
                if LEFTOVER.search(line) and "Limix-managed" not in line:
                    raise SystemExit(f"rebrand: brand glued into a technical name in {p.relative_to(ROOT)}: {line.strip()[:120]}")

# 6. Icons: the Limi mascot everywhere the cursor mascot was the app icon.
ICONS = {
    "limix-mark.svg": ["build/icon.svg", "public/app-icon.svg"],
    "icon-1024.png": ["build/icon-1024.png"],
    "icon-512.png": ["public/app-icon-512.png"],
    "icon-192.png": ["public/app-icon-192.png"],
    "apple-touch-icon.png": ["public/apple-touch-icon.png"],
    "app-icon.png": ["electron/resources/app-icon.png"],
    "icon.ico": ["build/icon.ico"],
    "icon.icns": ["build/icon.icns"],
}
for src, dests in ICONS.items():
    for dest in dests:
        target = ROOT / dest
        data = (ASSETS / src).read_bytes()
        if not target.exists() or target.read_bytes() != data:
            target.write_bytes(data)
            changed.append(dest)
iconset = ROOT / "build/icon.iconset"
if iconset.exists():
    for png in iconset.glob("*.png"):
        m = re.match(r"icon_(\d+)x\d+(@2x)?\.png", png.name)
        if m:
            size = int(m.group(1)) * (2 if m.group(2) else 1)
            data = (ASSETS / f"icon-{size}.png").read_bytes()
            if png.read_bytes() != data:
                png.write_bytes(data)
                changed.append(png.relative_to(ROOT).as_posix())

# 6b. Mascot: the trademark cursor outline becomes Limix Bot's "Limi" chat bubble. The body keeps the internal id
# "cursor" so every caller, stored bot and native client keeps working; only its outline and name change.
BUBBLE = """
/** Limix Bot's own mascot body: a rounded chat bubble whose tail sits at the bottom left. */
function buildBubble(): string {
  const x = 6, y = 8, w = 188, h = 164, k = 60
  return new Path()
    .moveTo(x + k, y)
    .lineTo(x + w - k, y)
    .quarterTo(x + w, y, x + w, y + k)
    .lineTo(x + w, y + h - k)
    .quarterTo(x + w, y + h, x + w - k, y + h)
    .lineTo(x + 84, y + h)
    .curveTo([x + 62, y + h, x + 40, y + h + 14, x + 16, y + h + 22])
    .curveTo([x + 8, y + h + 25, x + 4, y + h + 20, x + 6, y + h + 12])
    .curveTo([x + 8, y + h + 2, x, y + h - 20, x, y + h - 54])
    .lineTo(x, y + k)
    .quarterTo(x, y, x + k, y)
    .close()
}
"""
def builders(s):
    if "function buildBubble" not in s:
        i = s.index("export const BODY_DEFS")
        s = s[:i] + BUBBLE.lstrip("\n") + "\n" + s[i:]
    return s.replace('{ id: "cursor", name: "Cursor", d: CURSOR_D, viewBox: [0, 0, 512, 512] },',
                     '{ id: "cursor", name: "Limi", d: buildBubble(), viewBox: [0, 0, 200, 200] },')
edit("scripts/mascot-bodies/builders.ts", builders)
edit("scripts/gen-mascot-bodies.ts", lambda s: s if "const CAP = 0.83" in s else must(s, "const CAP = 1\n",
     "// Limix Bot: its bubble body holds a full-size face, so the catalog cap sits just under what the star body can hold.\nconst CAP = 0.83\n"))
before = (ROOT / "shared/mascot-bodies.ts").read_text(encoding="utf-8")
subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "scripts/gen-mascot-bodies.ts"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
if (ROOT / "shared/mascot-bodies.ts").read_text(encoding="utf-8") != before:
    changed.append("shared/mascot-bodies.ts")

# 8. Limix Bot features layered on the fork (sources under limix/overlay, copied to the same path).
OVERLAY = ROOT / "limix/overlay"
if OVERLAY.exists():
    for src in sorted(OVERLAY.rglob("*")):
        if src.is_file():
            rel = src.relative_to(OVERLAY).as_posix()
            dest = ROOT / rel
            if not dest.exists() or dest.read_bytes() != src.read_bytes():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, dest)
                changed.append(rel)

# 8a. @devs bug reports go to the Limix owner's inbox (limix-report-mail.ts), never to the OpenMausBot team.
OLD_IMPORT = 'import { bugReportEndpoint, devsReportSender, devsStatusAsker } from "./devs-report-send.ts";'
NEW_IMPORT = 'import { limixReportAlias, limixReportSender, limixStatusAsker } from "./limix-report-mail.ts";'
OLD_WIRING = "send: devsReportSender(bugReportEndpoint(process.env, CLOUD_HOME?.adminOrigin)), askStatus: devsStatusAsker(bugReportEndpoint(process.env, CLOUD_HOME?.adminOrigin), CLOUD_HOME),"
NEW_WIRING = "send: limixReportSender(limixReportAlias()), askStatus: limixStatusAsker(),"
def report_wiring(s):
    return must(must(s, OLD_IMPORT, NEW_IMPORT), OLD_WIRING, NEW_WIRING)
edit("server/index.ts", report_wiring)

REPORT_LINES = {
    "en": {
        "server.reports.sent": "Sent to the Limix Bot team (report {report}).",
        "server.reports.sentReply": "Sent to the Limix Bot team (report {report}). We'll reply to {contact}.",
        "server.reports.sentLater": "Sent to the Limix Bot team (report {report}) after an earlier try did not go through.",
        "server.reports.sentLaterReply": "Sent to the Limix Bot team (report {report}) after an earlier try did not go through. We'll reply to {contact}.",
    },
    "vi": {
        "server.reports.sent": "Đã gửi cho đội Limix Bot (báo cáo {report}).",
        "server.reports.sentReply": "Đã gửi cho đội Limix Bot (báo cáo {report}). Chúng tôi sẽ trả lời tới {contact}.",
        "server.reports.sentLater": "Đã gửi cho đội Limix Bot (báo cáo {report}) sau khi một lần thử trước đó không thành công.",
        "server.reports.sentLaterReply": "Đã gửi cho đội Limix Bot (báo cáo {report}) sau khi một lần thử trước đó không thành công. Chúng tôi sẽ trả lời tới {contact}.",
    },
}
UPSTREAM_TEAM = re.compile(r"\s*[^.!?。！？।]*(?:Milind|Omkar|ミリンド|밀린드|米林德|मिलिंद)[^.!?。！？।]*[.!?。！？।]")
def report_lines(lang):
    def fix(s):
        d = json.loads(s)
        for key in ("server.reports.sent", "server.reports.sentReply", "server.reports.sentLater", "server.reports.sentLaterReply"):
            if key not in d:
                continue
            if lang in REPORT_LINES:
                d[key] = REPORT_LINES[lang][key]
            else:
                d[key] = UPSTREAM_TEAM.sub("", d[key]).strip()
        return json.dumps(d, indent=2, ensure_ascii=False) + "\n"
    return fix
for p in sorted((ROOT / "src/locales").glob("*.json")):
    if p.name != "source-hashes.json":
        edit(p.relative_to(ROOT).as_posix(), report_lines(p.stem))

# 8b. Limix Bot is its own branded build: the app hides what a branded build hides (MausBot Cloud plans and their
# What's new popup, sponsor and upstream announcement cards, star and launch prompts). A brand.json still needs the
# whitelabel entitlement exactly as before; only the built-in Limix brand counts as applied.
OLD_FALLBACK = """    notice ? { brand: DEFAULT_BRAND, source: "default", file, notice } : { brand: DEFAULT_BRAND, source: "default", file };"""
NEW_FALLBACK = """    notice ? { brand: DEFAULT_BRAND, source: "file", file, notice } : { brand: DEFAULT_BRAND, source: "file", file };"""
edit("server/brand.ts", lambda s: must(s, OLD_FALLBACK, NEW_FALLBACK))

# 7. Attribution (Apache-2.0 section 4: state that files were changed, keep NOTICE).
NOTICE_LINE = f"Limix Bot is a modified version of OpenMausBot by {AUTHOR}"
def notice(s):
    if NOTICE_LINE in s:
        return s
    return (f"{NOTICE_LINE} ({REPO_URL}).\nChanges: product name, icons and mascot body, data folder, update feed,\n"
            "removal of the enterprise/ folder and of hosted cloud offers. OpenMausBot and MausBot are\n"
            "trademarks of Supamaus Software Private Limited; Limix Bot is not affiliated with them.\n\n" + s)
edit("NOTICE", notice)
(ROOT / "README.md").write_text((ASSETS / "README.limix.md").read_text(encoding="utf-8"), encoding="utf-8")

print(f"rebrand: {len(changed)} files changed")
for c in changed:
    print("  " + c)
