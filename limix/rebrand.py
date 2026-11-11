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
    # Python 3.12 and uv for the default skills (limix/skills): the Windows workflow downloads them into limix-runtime/.
    runtime = "    - from: limix-runtime\n      to: limix-runtime\n"
    anchor = "  extraResources:\n    - from: dist-native/cloudflared/win32-x64/cloudflared.exe\n"
    if runtime not in s:
        s = must(s, anchor, anchor.replace("  extraResources:\n", "  extraResources:\n" + runtime))
    return s
edit("electron-builder.yml", builder)
edit(".gitignore", lambda s: s if "/limix-runtime/" in s else s.rstrip("\n") + "\n# Limix Bot: Python and uv fetched by the Windows workflow\n/limix-runtime/\n")
edit(".gitignore", lambda s: s if "limix/__pycache__/" in s else s.rstrip("\n") + "\nlimix/__pycache__/\n")

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
def cloud_switch(s):
    gated = "  return LIMIX_CLOUD_ENABLED && app.isPackaged && !desktopRemoteAccess;"
    for old in ("  return app.isPackaged && !desktopRemoteAccess && brandedBuild === false;", "function cloudOffersAllowed() {\n  return false;\n}"):
        s = s.replace(old, gated if old.startswith("  return app") else "function cloudOffersAllowed() {\n" + gated + "\n}")
    if gated not in s:
        raise SystemExit("rebrand: cloudOffersAllowed not found in electron/main.mjs")
    imp = 'import { LIMIX_CLOUD_ENABLED } from "./limix-features.mjs";\n'
    if not re.search(r"import \{[^}]*LIMIX_CLOUD_ENABLED[^}]*\} from \"\./limix-features\.mjs\"", s):
        first = s.index("\nimport ") + 1
        s = s[:first] + imp + s[first:]
    return s
edit("electron/main.mjs", cloud_switch)
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

# 6a. Face: the trademark cursor eyes become Limix Bot's glowing pill eyes behind a dark visor (owner's reference
# picture, 2026-11-12). limix/face.py builds the 25 expressions in the engine's index order; the mouth folds away.
sys.path.insert(0, str(Path(__file__).resolve().parent))
import face  # noqa: E402

def face_data(s):
    s = re.sub(r"const ENCODED: string\[\] = \[\n.*?\n\]", lambda m: face.face_data_block(), s, count=1, flags=re.S)
    s = re.sub(r"export const MOUTHS: number\[\]\[\] = \[\n.*?\n\]", lambda m: face.MOUTHS_BLOCK, s, count=1, flags=re.S)
    if "export const VISOR" not in s:
        s = s.rstrip("\n") + "\n" + face.VISOR_TS
    return s
edit("src/components/cursor-face-data.ts", face_data)

def solve(s):
    s = must(s, "  MOUTHS,\n  MOUTH_STROKE,\n  mouthFrame,\n} from", "  MOUTHS,\n  MOUTH_STROKE,\n  VISOR,\n  mouthFrame,\n} from")
    if "Limix Bot: the visor stays put" in s:
        return s
    return must(s, "    // Sample the mouth curve; it is stroked, so it needs extra room.\n",
                "    // Limix Bot: the visor stays put while the eyes look around inside it, so it must fit as well.\n"
                "    for (let i = 0; i < 64; i++) {\n"
                "      const a = (i / 64) * Math.PI * 2\n"
                "      const c = Math.cos(a), s = Math.sin(a)\n"
                "      const hx = VISOR.w / 2 - VISOR.r, hy = VISOR.h / 2 - VISOR.r\n"
                "      xs.push(Math.sign(c) * hx + c * VISOR.r, Math.sign(s) * hy + s * VISOR.r)\n"
                "      needs.push(PAD)\n"
                "    }\n\n"
                "    // Sample the mouth curve; it is stroked, so it needs extra room.\n")
edit("scripts/mascot-bodies/solve.ts", solve)

# 6b. Mascot: the trademark cursor outline becomes Limix Bot's "Limi": a chubby round-tipped star (owner's reference
# picture, 2026-11-12). The body keeps the internal id "cursor" so every caller, stored bot and native client keeps
# working; only its outline and name change. The "star" slot carries the two overlapping blocks of the Limix mark
# ("giao thoa anh sang") so that shape stays on offer, and the polygons get softer corners to match.
LIMI_D = ("M62 51C70 51 75 51 83 51C88 36 101 27 122 27C134 27 145 27 156 27C178 27 190 41 190 64C190 82 190 99 190 117"
          "C190 141 176 154 153 154C143 154 132 154 121 154C116 168 104 176 84 176C71 176 58 176 44 176C21 176 10 161 10 139"
          "C10 122 10 105 10 87C10 63 26 51 49 51C53 51 58 51 62 51Z")
LIMI_STAR_D = face.puffy_star()
LIMI = f"""
/** Limix Bot's own mascot body "Limi": a chubby five-point star with round tips. */
const LIMI_STAR_D = "{LIMI_STAR_D}"
/** The blend in the Limix mark: two overlapping rounded blocks. */
const LIMI_D = "{LIMI_D}"
"""
OLD_LIMI = re.compile(r"/\*\* Limix Bot's own mascot body.*?\nconst LIMI_D = \"[^\"]*\"\n\n?", re.S)
OLD_BUBBLE = re.compile(r"/\*\* Limix Bot's own mascot body: a rounded chat bubble.*?\n}\n\n?", re.S)
def builders(s):
    s = OLD_BUBBLE.sub("", s)
    s = OLD_LIMI.sub("", s)
    i = s.index("export const BODY_DEFS")
    s = s[:i] + LIMI.lstrip("\n") + "\n" + s[i:]
    for old in ('{ id: "cursor", name: "Cursor", d: CURSOR_D, viewBox: [0, 0, 512, 512] },',
                '{ id: "cursor", name: "Limi", d: buildBubble(), viewBox: [0, 0, 200, 200] },',
                '{ id: "cursor", name: "Limi", d: LIMI_D, viewBox: [0, 0, 200, 200] },'):
        s = s.replace(old, '{ id: "cursor", name: "Limi", d: LIMI_STAR_D, viewBox: [0, 0, 200, 200] },')
    s = s.replace('{ id: "star", name: "Star", d: buildStar(196, 196, 5, 0.55), viewBox: [0, 0, 200, 200] },',
                  '{ id: "star", name: "Blend", d: LIMI_D, viewBox: [0, 0, 200, 200] },')
    s = s.replace("buildPolygon(196, 196, 6, 0.12)", "buildPolygon(196, 196, 6, 0.22)")
    s = s.replace("buildPolygon(196, 196, 4, 0.12)", "buildPolygon(196, 196, 4, 0.22)")
    return s
edit("scripts/mascot-bodies/builders.ts", builders)
# The visor face fills the star snugly at the upstream cap, so the catalog keeps CAP = 1 (an earlier Limix body
# lowered it to 0.83; put back if found).
edit("scripts/gen-mascot-bodies.ts", lambda s: s.replace(
    "// Limix Bot: its bubble body holds a full-size face, so the catalog cap sits just under what the star body can hold.\nconst CAP = 0.83\n",
    "const CAP = 1\n"))
before = (ROOT / "shared/mascot-bodies.ts").read_text(encoding="utf-8")
subprocess.run(["node", "--experimental-strip-types", "--no-warnings", "scripts/gen-mascot-bodies.ts"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
if (ROOT / "shared/mascot-bodies.ts").read_text(encoding="utf-8") != before:
    changed.append("shared/mascot-bodies.ts")

# 6d. Mascot finish: a soft 3D sheen instead of the flat diagonal ramp, the dark visor, and eyes that glow in a light
# tint of the body colour. The default colour ("chrome", a steel grey upstream) becomes Limix cyan.
def avatar_render(s):
    s = must(s, "  MOUTH_STROKE,\n  mouthFrame,\n  type Ring,\n} from \"./cursor-face-data\"",
             "  MOUTH_STROKE,\n  VISOR,\n  mouthFrame,\n  type Ring,\n} from \"./cursor-face-data\"")
    s = must(s, "      showMouth = true,\n", "      showMouth = false,\n")
    s = must(s, """          <linearGradient id={`${uid}-grad`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="55%" stopColor={gradient[1]} />
            <stop offset="100%" stopColor={gradient[2]} />
          </linearGradient>""", """          <radialGradient id={`${uid}-grad`} cx="0.36" cy="0.3" r="0.82" fx="0.32" fy="0.22">
            <stop offset="0%" stopColor={gradient[0]} />
            <stop offset="45%" stopColor={gradient[1]} />
            <stop offset="100%" stopColor={gradient[2]} />
          </radialGradient>
          <linearGradient id={`${uid}-visor`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#24333F" />
            <stop offset="100%" stopColor="#05090D" />
          </linearGradient>
          <clipPath id={`${uid}-vclip`}>
            <rect x={VISOR.x} y={VISOR.y} width={VISOR.w} height={VISOR.h} rx={VISOR.r} />
          </clipPath>""")
    s = must(s, """            <g transform={anchorTransform(silhouette.anchor)}>
              <path ref={eye0} fill={eyeColor} />
              <path ref={eye1} fill={eyeColor} />""", """            <g transform={anchorTransform(silhouette.anchor)}>
              <rect x={VISOR.x} y={VISOR.y} width={VISOR.w} height={VISOR.h} rx={VISOR.r} fill={`url(#${uid}-visor)`} stroke="#ffffff" strokeOpacity={0.12} strokeWidth={2} />
              <g clipPath={`url(#${uid}-vclip)`}>
              <use href={`#${uid}-eye0`} stroke={eyeColor} strokeWidth={12} strokeOpacity={0.16} strokeLinejoin="round" />
              <use href={`#${uid}-eye1`} stroke={eyeColor} strokeWidth={12} strokeOpacity={0.16} strokeLinejoin="round" />
              <path id={`${uid}-eye0`} ref={eye0} fill={eyeColor} />
              <path id={`${uid}-eye1`} ref={eye1} fill={eyeColor} />
              </g>""")
    return s
edit("src/components/CursorAvatar.tsx", avatar_render)
edit("src/lib/mascot.ts", lambda s: must(must(s,
     'export const CHROME_GRADIENT: [string, string, string] = ["#F1F4F7", "#AEB8C3", "#66717E"];',
     'export const CHROME_GRADIENT: [string, string, string] = ["#C4FAFF", "#45D6EE", "#137F9E"];'),
     'export const CHROME_EYES = "#1E2833";', 'export const CHROME_EYES = "#9CF7FF";').replace(
     '  chrome: "#B3BAC4",\n} satisfies Record<MausColor, string>;', '  chrome: "#45D6EE",\n} satisfies Record<MausColor, string>;'))
edit("src/components/Avatar.tsx", lambda s: must(s,
     "        eyeColor={faceInk ?? (chrome ? CHROME_EYES : undefined)}",
     "        eyeColor={faceInk ?? (chrome ? CHROME_EYES : mix(MAUS_COLORS[color] ?? MAUS_COLORS.green, \"#ffffff\", 0.62))}"))

edit("src/styles.css", lambda s: re.sub(r"--identity-chrome: #[0-9A-Fa-f]{6};",
     lambda m: "--identity-chrome: #3CCFEA;" if m.group(0).upper().endswith("B3BAC4;") or m.group(0).endswith("#3CCFEA;") else "--identity-chrome: #1590AE;", s))

edit("src/locales/en.json", lambda s: must(must(s, '"mascot.body.cursor": "Cursor",', '"mascot.body.cursor": "Limi",'),
     '"mascot.body.star": "Star",', '"mascot.body.star": "Blend",'))

# 6e. Windows taskbar unread badge: upstream overlays a 16 px copy of the app icon, which reads as a second logo on
# the Limix mark. Limix Bot overlays a red count dot instead (limix/overlay/electron/resources/unread-badge-*.png).
def unread_badge(s):
    s = must(s, "let unreadOverlayIcon = null;\n", "const unreadBadgeIcons = {};\n")
    return must(s, """    unreadOverlayIcon ??= nativeImage.createFromPath(APP_ICON).resize({ width: 16, height: 16 });
    win.setOverlayIcon(
      count > 0 && !unreadOverlayIcon.isEmpty() ? unreadOverlayIcon : null,""", """    // Limix Bot: a red count dot, not a second copy of the logo.
    const badgeName = count > 9 ? "9plus" : String(count);
    const badge = count > 0 ? (unreadBadgeIcons[badgeName] ??= nativeImage.createFromPath(path.join(__dirname, `resources/unread-badge-${badgeName}.png`))) : null;
    win.setOverlayIcon(
      badge && !badge.isEmpty() ? badge : null,""")
edit("electron/main.mjs", unread_badge)

# 6f. Organization sign-in ("Dang nhap bang tai khoan to chuc"): its default admin gateway points at Limix's own
# address (owner's choice 2026-11-12). Nothing answers there until Limix runs its own admin gateway.
LIMIX_ADMIN_ORIGIN = "https://admin.limixbot.com"
edit("src/components/OrganizationSettings.tsx", lambda s: must(s, 'const DEFAULT_PORTAL_ORIGIN = "https://admin.openmausbot.com";',
     f'const DEFAULT_PORTAL_ORIGIN = "{LIMIX_ADMIN_ORIGIN}";'))
edit("src/lib/onboarding.ts", lambda s: must(s, 'export const DEFAULT_ADMIN_ORIGIN = "https://admin.openmausbot.com";',
     f'export const DEFAULT_ADMIN_ORIGIN = "{LIMIX_ADMIN_ORIGIN}";'))

# 6g. Organization sign-in is a hidden module until Limix runs its own admin gateway (LIMIX_ORGANIZATION_ENABLED in
# limix/overlay/electron/limix-features.mjs). Without the preload bridge, Settings and onboarding hide their blocks.
def org_preload(s):
    s = must(s, '  organization: process.argv.includes("--omb-company-desktop=1") ? {',
             '  organization: LIMIX_ORGANIZATION_ENABLED && process.argv.includes("--omb-company-desktop=1") ? {')
    if "const LIMIX_ORGANIZATION_ENABLED" not in s:
        anchor = 'if (isLocalPage && !desktopRemoteClient && process.argv.includes("--omb-company-desktop=1")) {'
        s = must(s, anchor, "// Limix Bot: organization sign-in is hidden (electron/limix-features.mjs LIMIX_ORGANIZATION_ENABLED).\n"
                 "const LIMIX_ORGANIZATION_ENABLED = false;\n" + anchor)
    return s
edit("electron/preload.cjs", org_preload)
edit("electron/menu.mjs", lambda s: must(s,
     '      { id: "organization-sign-in", label: t("native.menu.orgSignIn"), click: onOrganizationSignIn },',
     '      ...(onOrganizationSignIn ? [{ id: "organization-sign-in", label: t("native.menu.orgSignIn"), click: onOrganizationSignIn }] : []),'))
def org_main(s):
    if "LIMIX_ORGANIZATION_ENABLED }" not in s and "LIMIX_ORGANIZATION_ENABLED," not in s:
        s = must(s, 'import { LIMIX_CLOUD_ENABLED } from "./limix-features.mjs";',
                 'import { LIMIX_CLOUD_ENABLED, LIMIX_ORGANIZATION_ENABLED } from "./limix-features.mjs";')
    return must(s, '      onOrganizationSignIn: () => queueOrganizationEntry("openmausbot://organization"),',
                '      onOrganizationSignIn: LIMIX_ORGANIZATION_ENABLED ? () => queueOrganizationEntry("openmausbot://organization") : undefined,')
edit("electron/main.mjs", org_main)

# 6h. Windows installer: stop processes still running from the install folder before installing (limix/overlay/build/
# limix-installer.nsh). Without it an update could remove the old UI and fail to write the new one ("no route: GET /").
edit("electron-builder.yml", lambda s: s if "include: build/limix-installer.nsh" in s else must(s,
     "nsis:\n  oneClick: true\n", "nsis:\n  oneClick: true\n  include: build/limix-installer.nsh\n"))

# 6i. A damaged install (the UI folder missing, e.g. after an interrupted update) used to open a window showing
# {"error":"no route: GET /"}. Limix Bot says so plainly instead and offers the installer download.
def ui_check(s):
    if "Limix Bot: a damaged install" in s:
        return s
    return must(s, "app.whenReady().then(async () => {\n", """app.whenReady().then(async () => {
  // Limix Bot: a damaged install (no UI files, e.g. after an interrupted update) explains itself instead of showing
  // a bare "no route" page.
  if (app.isPackaged && !fs.existsSync(path.join(process.resourcesPath, "ui", "index.html"))) {
    const vi = /^vi\b/i.test(app.getLocale());
    const { response } = await dialog.showMessageBox({
      type: "error",
      buttons: [vi ? "Tải bản cài" : "Download installer", vi ? "Thoát" : "Quit"],
      defaultId: 0, cancelId: 1,
      message: vi ? "Bộ cài Limix Bot bị thiếu tệp" : "Limix Bot's installation is missing files",
      detail: vi
        ? "Có thể lần cập nhật trước bị gián đoạn. Hãy tải và chạy lại LimixBot-setup.exe. Bot, cuộc trò chuyện và cài đặt của bạn vẫn được giữ nguyên."
        : "An earlier update may have been interrupted. Download and run LimixBot-setup.exe again. Your bots, chats and settings are kept.",
    });
    if (response === 0) await shell.openExternal("https://github.com/leomieo/limix-bot/releases/latest");
    app.exit(1);
    return;
  }
""")
edit("electron/main.mjs", ui_check)

# 6c. MausBot's finished chrome pictures of the trademark cursor (face included) go: with no pictures for a body the
# avatar keeps its drawn steel finish over the Limi outline (src/lib/steel-body.ts).
steel = ROOT / "src/assets/mausbot-steel"
if steel.exists():
    for pic in sorted(steel.glob("cursor-*.*")):
        pic.unlink()
        changed.append(pic.relative_to(ROOT).as_posix())

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

# 8c. The Settings section for a Cloud account follows the Limix Cloud module switch.
def settings_cloud(s):
    imp = 'import { LIMIX_CLOUD_ENABLED } from "../../shared/limix-features";\n'
    s = must(s, '  const availableSections = baseSections.filter((entry) => entry.id !== "skills" || skillsLibraryEnabled(state.config));',
             '  const availableSections = baseSections.filter((entry) => (entry.id !== "skills" || skillsLibraryEnabled(state.config)) && (entry.id !== "cloudAccount" || LIMIX_CLOUD_ENABLED));')
    if imp not in s:
        first = s.index("\nimport ") + 1
        s = s[:first] + imp + s[first:]
    return s
edit("src/components/SettingsModal.tsx", settings_cloud)

# 8d. Every other way into Limix Cloud follows the same switch: the plan/offer rows in Settings (General, Usage &
# billing), routine notes, onboarding chips, "more pages" buttons, and the Add-a-Cloud dialog itself.
def cloud_gate(rel, pairs):
    depth = rel.count("/")
    imp = 'import { LIMIX_CLOUD_ENABLED } from "' + "../" * depth + 'shared/limix-features";\n'
    def fn(s):
        for old, new in pairs:
            s = must(s, old, new)
        if imp not in s:
            first = s.index("import ")
            s = s[:first] + imp + s[first:]
        return s
    edit(rel, fn)
cloud_gate("src/lib/cloud-plan.ts", [(
    '  return view.kind === "signed-out" || (view.kind === "free" && !view.invited);',
    '  return LIMIX_CLOUD_ENABLED && (view.kind === "signed-out" || (view.kind === "free" && !view.invited));')])
cloud_gate("src/components/ProIntroduction.tsx", [(
    '  return bridge ? { view: cloudPlanView(account), account } : null;',
    '  return bridge && LIMIX_CLOUD_ENABLED ? { view: cloudPlanView(account), account } : null;')])
cloud_gate("src/lib/default-bot.ts", [(
    '    ...(fresh && !input.onCloud && !input.remote ? ["cloud" as const] : []),',
    '    ...(LIMIX_CLOUD_ENABLED && fresh && !input.onCloud && !input.remote ? ["cloud" as const] : []),')])
cloud_gate("src/components/app/PageTools.tsx", [(
    '{state.card?.upgrade && window.ogb?.cloudAccount',
    '{LIMIX_CLOUD_ENABLED && state.card?.upgrade && window.ogb?.cloudAccount')])
cloud_gate("src/components/PublishedPageCard.tsx", [(
    '{card.upgrade && bridge && <button',
    '{LIMIX_CLOUD_ENABLED && card.upgrade && bridge && <button')])
cloud_gate("src/state/store.tsx", [(
    '    case "openCloudAdd":\n      return {',
    '    case "openCloudAdd":\n      if (!LIMIX_CLOUD_ENABLED) return state.cloudHowTo ? { ...state, cloudHowTo: false } : state;\n      return {')])

# 8e. Sign-in gate: before the splash, the computer must be signed in to a Limix account (limix/docs/MODULE_ACCOUNT.md).
def account_gate(s):
    if "limixAccountGate" not in s:
        m = re.search(r'import \{ ([^}]*) \} from "\./limix-features\.mjs";\n', s)
        if not m:
            raise SystemExit("rebrand: limix-features import not found in electron/main.mjs")
        names = sorted(set(m.group(1).split(", ")) | {"LIMIX_ACCOUNT_URL"})
        s = s.replace(m.group(0), 'import { ' + ", ".join(names) + ' } from "./limix-features.mjs";\nimport { limixAccountGate } from "./limix-account.mjs";\n', 1)
    if "limixAccountGate({" in s:
        return s
    return must(s, "  hiddenStart = loginItem.startedHidden() || reopenedOutOfSight();\n",
                "  // Limix Bot: no app until this computer is signed in to a Limix account (closing the sign-in window quits).\n"
                "  if (!(await limixAccountGate({ app, BrowserWindow, ipcMain, safeStorage, shell, dialog, iconPath: APP_ICON, log: slog, baseUrl: LIMIX_ACCOUNT_URL }))) { app.quit(); return; }\n"
                "  hiddenStart = loginItem.startedHidden() || reopenedOutOfSight();\n")
edit("electron/main.mjs", account_gate)
# 8f. No Limix phone app yet: hide "Get the phone app" (menu entry, dialog, App Store/APK codes); keep "Connect phone".
def phone_gate(rel, pairs):
    depth = rel.count("/")
    imp = 'import { LIMIX_PHONE_APPS_ENABLED } from "' + "../" * depth + 'shared/limix-features";\n'
    def fn(s):
        for old, new in pairs:
            s = must(s, old, new)
        if imp not in s:
            first = s.index("import ")
            s = s[:first] + imp + s[first:]
        return s
    edit(rel, fn)
phone_gate("src/components/SidebarProfileMenu.tsx", [
    ("""    {
      key: "phone-app",
      label: t("sidebar.menu.getPhoneApp"),
      icon: <Download size={18} />,
      onSelect: onGetApp,
    },
  ];""", """    ...(LIMIX_PHONE_APPS_ENABLED ? [{
      key: "phone-app",
      label: t("sidebar.menu.getPhoneApp"),
      icon: <Download size={18} />,
      onSelect: onGetApp,
    } satisfies SidebarMenuItem] : []),
  ];"""),
    ("    phone: simple\n      ? simplePhoneItems(", "    phone: simple && LIMIX_PHONE_APPS_ENABLED\n      ? simplePhoneItems("),
    ("      {phoneAppOpen && <PhoneAppDialog", "      {LIMIX_PHONE_APPS_ENABLED && phoneAppOpen && <PhoneAppDialog"),
])
phone_gate("src/components/PhonePairingQr.tsx", [
    ("""        <button onClick={() => setStoreOpen((open) => !open)} aria-expanded={storeOpen} className="text-[12px] text-ink-secondary hover:text-ink">
          {t("phone.code.e2e.getApp")}
        </button>
        {storeOpen && (""", """        {LIMIX_PHONE_APPS_ENABLED && <button onClick={() => setStoreOpen((open) => !open)} aria-expanded={storeOpen} className="text-[12px] text-ink-secondary hover:text-ink">
          {t("phone.code.e2e.getApp")}
        </button>}
        {LIMIX_PHONE_APPS_ENABLED && storeOpen && ("""),
])

# 8g. Bundled Python and uv for the default skills (limix/skills, limix/overlay/electron/limix-runtime.mjs).
def runtime_env(s):
    imp = 'import { limixRuntimeEnv } from "./limix-runtime.mjs";\n'
    if imp not in s:
        s = must(s, 'import { limixAccountGate } from "./limix-account.mjs";\n', 'import { limixAccountGate } from "./limix-account.mjs";\n' + imp) \
            if 'import { limixAccountGate } from "./limix-account.mjs";\n' in s else s.replace('\nimport ', '\n' + imp + 'import ', 1)
    old = "    ...desktopDataDirLease.utilityServerLeaseEnvironment(),\n"
    new = old + '    ...limixRuntimeEnv({ resourcesPath: process.resourcesPath, userData: app.getPath("userData") }),\n'
    return s if new in s else must(s, old, new)
edit("electron/main.mjs", runtime_env)

# 9a. Brand words the whole-file literal pass above can miss: one stray apostrophe in a comment shifts its quote
# pairing for the rest of the file. This pass pairs quotes line by line, so error messages and prompts that still said
# "OpenMausBot" now say Limix Bot.
def fix_line(line):
    st = line.lstrip()
    if st.startswith(("//", "*", "/*")):
        return line
    out, i, q, seg = [], 0, None, []
    while i < len(line):
        c = line[i]
        if q is None:
            out.append(c)
            if c in "\"'`":
                q, seg = c, []
        elif c == "\\" and i + 1 < len(line):
            seg.append(line[i:i + 2])
            i += 2
            continue
        elif c == q:
            out.append(fix_text("".join(seg)))
            out.append(c)
            q = None
        else:
            seg.append(c)
        i += 1
    if q is not None:
        out.append("".join(seg))
    return "".join(out)

def line_pass(s):
    return "\n".join(fix_line(l) if "Maus" in l else l for l in s.split("\n"))
for folder in ("src", "server", "shared", "electron", "companion"):
    for p in sorted((ROOT / folder).rglob("*")):
        rel = p.relative_to(ROOT).as_posix()
        if not p.is_file() or TEST.search(rel) or p.suffix not in (".ts", ".tsx", ".mjs", ".cjs", ".js") or "/locales/" in rel or "node_modules" in rel:
            continue
        edit(rel, line_pass)

# 9b. The Local VM (Cua Driver) image and the paths inside it carry the Limix name, so Settings > Computer no longer
# shows "openmausbot". The image layer number goes up, so a VM built from the old image is recreated once. Container
# and label names stay: they identify containers earlier builds made, and the Local VM page never shows them.
def vm_names(s):
    s = s.replace('"localhost/openmausbot/cua-local-vm"', '"localhost/limixbot/cua-local-vm"')
    s = s.replace('"/usr/local/libexec/openmausbot/cua-driver"', '"/usr/local/libexec/limixbot/cua-driver"')
    s = s.replace('"/run/user/1000/openmausbot-cua.sock"', '"/run/user/1000/limixbot-cua.sock"')
    s = s.replace('export const IMAGE_LAYER_VERSION = "8";', 'export const IMAGE_LAYER_VERSION = "9";')
    return s
edit("server/container-computer.ts", vm_names)
for rel in ("server/container-computer.test.ts", "server/desktop-updates.e2e.test.ts", "server/vps-computer.test.ts",
            "server/vps-container-mcp.test.ts", "scripts/smoke-cua-container.mjs"):
    if (ROOT / rel).exists():
        edit(rel, lambda s: s.replace("localhost/openmausbot/cua-local-vm", "localhost/limixbot/cua-local-vm")
              .replace("localhost\\/openmausbot\\/cua-local-vm", "localhost\\/limixbot\\/cua-local-vm")
              .replace("libexec/openmausbot/cua-driver", "libexec/limixbot/cua-driver")
              .replace("/run/user/1000/openmausbot-cua.sock", "/run/user/1000/limixbot-cua.sock"))

# 9c. Quit from the tray (or File > Quit) ends every helper the app started: the server, the Cua driver, browsers.
# After the usual orderly stop, anything still running from the install folder is stopped too.
QUIT_OLD = 'app.on("will-quit", () => { desktopTray?.destroy(); void tailnetShare.stop(); });\n'
QUIT_NEW = QUIT_OLD + r"""// Limix Bot: Quit ends every helper process the app started. The orderly stop above runs first; this clears any
// process still running from the install folder (packaged Windows builds only).
app.on("will-quit", () => {
  if (process.platform !== "win32" || !app.isPackaged) return;
  try {
    const dir = path.dirname(process.execPath).replace(/'/g, "''") + "\\";
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command",
      `$dir='${dir}'; Get-Process | Where-Object { $_.Id -ne ${process.pid} -and $_.Path -and $_.Path.StartsWith($dir, [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force -ErrorAction SilentlyContinue`],
      { windowsHide: true, timeout: 6000, stdio: "ignore" });
  } catch {}
});
"""
def quit_sweep(s):
    if "Limix Bot: Quit ends every helper" not in s:
        s = must(s, QUIT_OLD, QUIT_NEW)
    if 'import { execFileSync } from "node:child_process";' not in s and "execFileSync }" not in s and "execFileSync," not in s:
        s = must(s, 'import fs from "node:fs";\n', 'import fs from "node:fs";\nimport { execFileSync } from "node:child_process";\n')
    return s
edit("electron/main.mjs", quit_sweep)

# 9d. "Community repo" in the team-template dialog opens Limix Bot's own repository of Vietnamese templates.
def community(s):
    return s.replace("milind-soni/openmausbot-teams", "leomieo/limix-bot-teams")
for rel in ("server/team-library.ts", "server/team-library.test.ts", "src/components/TeamLibraryPanel.tsx"):
    edit(rel, community)

# 9e. Learning skills like Hermes Agent: the background skill review and the skills library start on (upstream: off).
# A bot still needs the owner's approval for a new skill unless the chat has full access, and every change has Undo.
def on_by_default(s):
    return s.replace("cfg.features?.skillReview === true", "cfg.features?.skillReview !== false") \
            .replace("config?.features?.skillReview === true", "config?.features?.skillReview !== false") \
            .replace("config?.features?.skillsLibrary === true", "config?.features?.skillsLibrary !== false") \
            .replace("cfg.features?.skillsLibrary === true", "cfg.features?.skillsLibrary !== false")
for rel in ("server/config.ts", "server/index.ts", "server/skill-library.ts", "src/lib/feature-flags.ts"):
    edit(rel, on_by_default)
edit("src/locales/en.json", lambda s: s.replace("Off by default. After a bot has run enough tool steps", "On by default. After a bot has run enough tool steps"))

# 9f. Gold text when a bot learns a skill (Hermes shows the same moment in gold): the line in the chat that says a bot
# added or updated a skill shimmers a few times, then stays gold.
GOLD_CSS = """

/* Limix Bot: gold text when a bot learns a skill */
@keyframes limix-gold-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.limix-gold-text {
  background-image: linear-gradient(100deg, #b8860b 0%, #f2c94c 22%, #fff1a8 50%, #f2c94c 78%, #b8860b 100%);
  background-size: 200% auto;
  -webkit-background-clip: text; background-clip: text;
  color: transparent; -webkit-text-fill-color: transparent;
  font-weight: 600;
  animation: limix-gold-shimmer 3s linear 3;
}
@media (prefers-reduced-motion: reduce) { .limix-gold-text { animation: none; } }
"""
edit("src/styles.css", lambda s: s if "limix-gold-text" in s else s.rstrip("\n") + GOLD_CSS)
def gold_card(s):
    if "limix-gold-text" in s:
        return s
    s = must(s, 'import { Check, Clock3, ShieldCheck, Undo2, X } from "lucide-react";',
             'import { Check, Clock3, ShieldCheck, Sparkles, Undo2, X } from "lucide-react";')
    s = must(s, "  const skill = card.skillRequest;\n  const shared = skill?.shared",
             '  const skill = card.skillRequest;\n  const learned = !undone && (skill?.action === "create" || skill?.action === "update");\n  const shared = skill?.shared')
    s = must(s, '{undone ? <Undo2 size={13} className="shrink-0 self-center" /> : <Check size={13} className="shrink-0 self-center text-success/80" />}\n        <span className="min-w-0 break-words">\n          {summary.line}',
             '{undone ? <Undo2 size={13} className="shrink-0 self-center" /> : learned ? <Sparkles size={13} className="shrink-0 self-center text-[#f2c94c]" /> : <Check size={13} className="shrink-0 self-center text-success/80" />}\n        <span className="min-w-0 break-words">\n          <span className={learned ? "limix-gold-text" : undefined}>{summary.line}</span>')
    return s
edit("src/components/ApprovalCard.tsx", gold_card)

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
