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
        if f.name not in ("limix-desktop.yml", "limix-windows.yml", "limix-npm.yml", "limix-cloudflare.yml", "limix-site.yml", "limix-docker.yml"):
            f.unlink()
            changed.append(f".github/workflows/{f.name} (removed)")
shutil.copy(ASSETS / "limix-windows.yml", wf / "limix-windows.yml")
shutil.copy(ASSETS / "limix-npm.yml", wf / "limix-npm.yml")
shutil.copy(ASSETS / "limix-cloudflare.yml", wf / "limix-cloudflare.yml")
shutil.copy(ASSETS / "limix-site.yml", wf / "limix-site.yml")
shutil.copy(ASSETS / "limix-docker.yml", wf / "limix-docker.yml")

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
    s = s.replace(' title="Based on OpenMausBot (Apache-2.0)"', '')
    line = f'        <p className="mt-2 text-[12px] text-ink-secondary">{AUTHOR}</p>\n'
    old_line = f'        <p className="mt-2 text-[12px] text-ink-secondary">{AUTHOR} · Based on OpenMausBot (Apache-2.0)</p>\n'
    if old_line in s:
        return s.replace(old_line, line)
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

# 9g. Help menu: no "Help center" row; "Send feedback" gets a Zalo icon and opens the owner's Zalo chat.
def help_menu(s):
    if "onHelp?: () => void" in s:
        return s
    if "ZaloIcon" not in s:
        s = must(s, 'import { DiscordIcon } from "./DiscordIcon";', 'import { ZaloIcon } from "./ZaloIcon";')
    s = must(s, "  HelpCircle,\n", "")
    s = must(s, '    { key: "help", label: t("sidebar.menu.help"), icon: <HelpCircle size={18} />, onSelect: onHelp },\n', "")
    s = must(s, 'icon: <DiscordIcon size={17} />', 'icon: <ZaloIcon size={17} />')
    s = must(s, "  onHelp,\n  onFeedback,\n", "  onFeedback,\n")
    return must(s, "  onHelp: () => void;\n", "  onHelp?: () => void;\n")
edit("src/components/SidebarProfileMenu.tsx", help_menu)
edit("src/components/SidebarProfileMenu.test.ts", lambda s: s.replace('"https://discord.gg/9Wb8MEpXRs"', '"https://zalo.me/0977242439"')
     .replace('toEqual(["help", "feedback", "shortcuts", "about"])', 'toEqual(["feedback", "shortcuts", "about"])')
     .replace('toEqual(["help", "feedback", "shortcuts", "about", "update"])', 'toEqual(["feedback", "shortcuts", "about", "update"])'))
edit("src/lib/app-links.ts", lambda s: s.replace('export const FEEDBACK_URL = "https://discord.gg/9Wb8MEpXRs";', 'export const FEEDBACK_URL = "https://zalo.me/0977242439";'))

# 9h. Learned skills are added at once, no question asked (owner's choice 2026-11-12). Settings > Experimental has a switch
# (features.skillAutoApply, on unless false); when it is off, a skill the background review learns waits in the chat as
# a card asking whether to learn it (the same card a bot's own skill proposal uses).
def auto_apply_flag(s):
    s = s.replace("skillReview?: boolean; skillReviewSteps", "skillReview?: boolean; skillAutoApply?: boolean; skillReviewSteps")
    if "skillAutoApply: z.boolean()" not in s and "  skillReview: z.boolean().optional(),\n" in s:
        s = s.replace("  skillReview: z.boolean().optional(),\n",
                      "  skillReview: z.boolean().optional(),\n  /** A skill the review learns is added at once. On unless false; off, the owner is asked first. */\n  skillAutoApply: z.boolean().optional(),\n", 1)
    return s
for rel in ("server/config.ts", "src/lib/feature-flags.ts", "src/state/config-status.ts"):
    edit(rel, auto_apply_flag)
edit("server/config.ts", lambda s: s if "export function skillAutoApplyEnabled" in s else must(s,
     "export function skillReviewEnabled(cfg: AppConfig): boolean {",
     "export function skillAutoApplyEnabled(cfg: AppConfig): boolean {\n  return cfg.features?.skillAutoApply !== false;\n}\n\nexport function skillReviewEnabled(cfg: AppConfig): boolean {"))
edit("src/lib/feature-flags.ts", lambda s: s if "export function skillAutoApplyEnabled" in s else must(s,
     "export function skillReviewSteps(",
     "export function skillAutoApplyEnabled(config: FeatureFlagConfig | null | undefined): boolean {\n  return config?.features?.skillAutoApply !== false;\n}\n\nexport function skillReviewSteps("))
def auto_apply_server(s):
    if "skillAutoApplyEnabled" not in s:
        s = must(s, "  skillReviewEnabled,\n  skillReviewSteps,\n", "  skillAutoApplyEnabled,\n  skillReviewEnabled,\n  skillReviewSteps,\n")
        s = must(s, "      skillReview: cfg.features?.skillReview !== false,\n",
                 "      skillReview: cfg.features?.skillReview !== false,\n      skillAutoApply: skillAutoApplyEnabled(cfg),\n")
    if "Limix Bot: owner asked first" in s:
        return s
    old = """    const direct = appliesDirectly(botId, threadId);
    if (!direct) return { ok: false, error: "this conversation cannot apply skill changes without review" };
    if (change.action === "update" && skillsHost.editable(botId, change.name)) return skillsHost.applyReviewUpdate(bot, threadId, change, direct);
    const staged = stageSkillWrite(botId, {"""
    new = """    const direct = appliesDirectly(botId, threadId);
    if (!direct) return { ok: false, error: "this conversation cannot apply skill changes without review" };
    const askFirst = !skillAutoApplyEnabled(cfg); // Limix Bot: owner asked first
    if (change.action === "update" && skillsHost.editable(botId, change.name)) {
      if (askFirst) return { ok: false, error: "a team-shared skill is not changed while learning asks first" };
      return skillsHost.applyReviewUpdate(bot, threadId, change, direct);
    }
    const staged = stageSkillWrite(botId, {"""
    s = must(s, old, new)
    old2 = """    if ("error" in staged) return { ok: false, error: staged.error };
    const applied = applyOwnStagedSkill(bot, threadId, staged, direct);"""
    new2 = """    if ("error" in staged) return { ok: false, error: staged.error };
    if (askFirst) {
      try {
        const card = appendSkillRequestCard({ botId, threadId, staged });
        appendDecision(DATA_DIR, { threadId, requestId: card.requestId, botId, botName: bot.name, tool: "stage_skill",
          summary: card.summary, decision: "card-shown", source: "skill" });
        return { ok: true };
      } catch (error) {
        rejectStagedSkillWrite(botId, staged.id);
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    const applied = applyOwnStagedSkill(bot, threadId, staged, direct);"""
    return must(s, old2, new2)
edit("server/index.ts", auto_apply_server)

def auto_apply_ui(s):
    if "skillAutoApply" in s:
        return s
    s = must(s, "  skillReviewEnabled,\n", "  skillAutoApplyEnabled,\n  skillReviewEnabled,\n")
    s = must(s, "  const enabled = skillReviewEnabled(state.config);\n", "  const enabled = skillReviewEnabled(state.config);\n  const autoApply = skillAutoApplyEnabled(state.config);\n")
    s = must(s, "features: { skillReview?: boolean; skillReviewSteps?: number }", "features: { skillReview?: boolean; skillAutoApply?: boolean; skillReviewSteps?: number }")
    return must(s, "      {enabled ? (\n        <div className=\"mt-3 flex items-center gap-3\">",
"""      {enabled ? (
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] text-ink">{t("settings.experimental.skillAutoApply")}</div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-ink-secondary">{t("settings.experimental.skillAutoApplyDetail")}</div>
          </div>
          <Switch
            checked={autoApply}
            aria-label={t("settings.experimental.skillAutoApplyAria")}
            disabled={saving}
            onClick={() => void save({ skillAutoApply: !autoApply })}
            className="disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      ) : null}
      {enabled ? (
        <div className="mt-3 flex items-center gap-3">""")
edit("src/components/SkillReviewSettings.tsx", auto_apply_ui)

AUTO_KEYS_EN = {
    "settings.experimental.skillAutoApply": "Learn new skills without asking",
    "settings.experimental.skillAutoApplyDetail": "On: a skill a bot learns is added at once, with Undo. Off: the bot asks “Learn this new skill?” first.",
    "settings.experimental.skillAutoApplyAria": "Learn new skills without asking",
}
def auto_keys(s):
    d = json.loads(s)
    if "settings.experimental.skillAutoApply" in d:
        return s
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == "settings.experimental.skillReviewAria":
            out.update(AUTO_KEYS_EN)
    return json.dumps(out, indent=2, ensure_ascii=False) + "\n"
edit("src/locales/en.json", auto_keys)

# 10a. Remote access with the Limix Studio account: the control plane accepts `Bearer limix.<machine>.<token>` (checked
# against the account server) before it tries the e-mail-code session. limix-auth.ts and wrangler.limix.jsonc come from the overlay.
def cp_auth(s):
    if 'from "./limix-auth"' not in s:
        s = must(s, 'import { sendOTPEmail } from "./email";', 'import { sendOTPEmail } from "./email";\nimport { limixSession } from "./limix-auth";')
    s = must(s, 'export async function accountSession(request: Request, auth: ControlPlaneAuth) {\n',
             'export async function accountSession(request: Request, auth: ControlPlaneAuth, env?: Env) {\n  if (env) { const limix = await limixSession(request, env); if (limix) return limix; }\n')
    return s
edit("cloudflare/control-plane/src/auth.ts", cp_auth)
edit("cloudflare/control-plane/src/index.ts", lambda s: must(s, 'await accountSession(request, auth);', 'await accountSession(request, auth, env);'))
def cp_inst(s):
    s = must(s, 'async function requireAccount(request: Request, auth: ControlPlaneAuth) {\n  const session = await accountSession(request, auth);',
             'async function requireAccount(request: Request, auth: ControlPlaneAuth, env: Env) {\n  const session = await accountSession(request, auth, env);')
    return must(s, 'await requireAccount(request, auth);', 'await requireAccount(request, auth, env);')
edit("cloudflare/control-plane/src/installations.ts", cp_inst)

# 10b. The app signs in to remote access with the Limix account (no e-mail code), reaches limixmedia.com addresses, and
# talks to accounts.limixmedia.com. connectLimix() reuses the whole sign-in tail of verifyCode().
def svc_limix(s):
    if "signInFlow" in s:
        return s
    s = must(s, "  const verifyCode = (rawEmail, rawCode) => serialize(async () => {", "  const signInFlow = (rawEmail, obtain) => serialize(async () => {")
    s = must(s, "      verified = await client.verifyOTP(email, rawCode);", "      verified = await obtain(email);")
    s = must(s, "\n  const retryWork = async () => {",
             "\n  const verifyCode = (rawEmail, rawCode) => signInFlow(rawEmail, (email) => client.verifyOTP(email, rawCode));\n"
             "  // Limix account: its bearer is `limix.<machine>.<token>`; the control plane checks it with the account server.\n"
             "  const connectLimix = (credential) => signInFlow(credential.email, async () => ({\n"
             "    accountToken: credential.bearer,\n    user: { id: credential.userId, email: credential.email },\n  }));\n\n  const retryWork = async () => {")
    return must(s, "    verifyCode,\n", "    verifyCode,\n    connectLimix,\n")
edit("electron/companion-account-service.mjs", svc_limix)
# 10b2. An older Limix build signed remote access in to the OpenMausBot service (c-….openmausbot.com addresses). Such a
# leftover account is forgotten on this computer only, and remote access signs in again with the Limix account.
def svc_forget(s):
    if "forgetForeign" in s:
        return s
    s = must(s, "\n  const retryWork = async () => {",
             "\n  const forgetForeign = () => serialize(async () => {\n"
             "    const document = credentials();\n"
             "    const account = storedAccount(document);\n"
             "    if (!account) return false;\n"
             "    const access = managedCompanionTunnelAccess(document);\n"
             "    let host = \"\";\n"
             "    try { host = access?.endpoint ? new URL(access.endpoint).hostname : \"\"; } catch { host = \"\"; }\n"
             "    if (account.userId.startsWith(\"limix:\") && (!host || host.endsWith(\".limixmedia.com\"))) return false;\n"
             "    await clearAfterCleanup();\n"
             "    return true;\n"
             "  });\n\n  const retryWork = async () => {", )
    return must(s, "    connectLimix,\n", "    connectLimix,\n    forgetForeign,\n")
edit("electron/companion-account-service.mjs", svc_forget)
edit("electron/companion-account-service.mjs", lambda s: must(s, 'DEFAULT_COMPANION_CONTROL_PLANE_URL = "https://accounts.openmausbot.com"', 'DEFAULT_COMPANION_CONTROL_PLANE_URL = "https://accounts.limixmedia.com"'))
edit("electron/desktop-companion-client.mjs", lambda s: must(s, '["openmausbot.com", "mausbot.si", NEXT_MANAGED_COMPANION_HOST_SUFFIX]', '["limixmedia.com", "openmausbot.com", "mausbot.si", NEXT_MANAGED_COMPANION_HOST_SUFFIX]'))
def main_limix(s):
    if "limixAutoConnect" in s:
        return s
    s = must(s, 'import { limixAccountGate } from "./limix-account.mjs";', 'import { limixAccountGate, limixRemoteCredential } from "./limix-account.mjs";')
    s = must(s, 'ipcMain.handle("companion-account:state", localOnly("companion-account:state", () => ensureCompanionAccountService().state()));',
        "// Signed in to Limix: remote access signs in by itself with that account, no e-mail code.\n"
        "let limixConnectAt = 0;\n"
        "async function limixAutoConnect() {\n"
        "  const credential = limixRemoteCredential();\n"
        "  if (!credential || Date.now() - limixConnectAt < 60_000) return;\n"
        "  const service = ensureCompanionAccountService();\n"
        "  const current = await service.state();\n"
        '  if (current?.status !== "signed-out" || managedRemoteAccessRefusal()) return;\n'
        "  limixConnectAt = Date.now();\n"
        "  service.connectLimix(credential).catch(() => {});\n"
        "}\n"
        'ipcMain.handle("companion-account:state", localOnly("companion-account:state", async () => { await limixAutoConnect().catch(() => {}); return ensureCompanionAccountService().state(); }));')
    return s
edit("electron/main.mjs", main_limix)

def main_forget(s):
    if "forgetForeign" in s:
        return s
    return must(s, "  const service = ensureCompanionAccountService();\n  const current = await service.state();\n",
                "  const service = ensureCompanionAccountService();\n  if (await service.forgetForeign().catch(() => false)) limixConnectAt = 0;\n  const current = await service.state();\n")
edit("electron/main.mjs", main_forget)

# 10c. Settings > General: e-mail and name come from the Limix account until the owner types their own.
def profile_fallback(s):
    s = must(s, 'name: cfg.profile?.name ?? "", email: cfg.profile?.email ?? "", aboutMe:', 'name: cfg.profile?.name || process.env.LIMIX_ACCOUNT_NAME || "", email: cfg.profile?.email || process.env.LIMIX_ACCOUNT_EMAIL || "", aboutMe:')
    return s
edit("server/index.ts", profile_fallback)

# 10d. About: only "A desktop home for your agents." (no "built on ..., open source" tail). Example address uses limix.example.com.
def about_tagline(s):
    return must(s, '"about.tagline": "A desktop home for your agents, built on {app}: open source, Apache 2.0 licensed."', '"about.tagline": "A desktop home for your agents."')
edit("src/locales/en.json", about_tagline)
edit("src/locales/en.json", lambda s: must(s, '"connect.addressPlaceholder": "https://maus.example.com or', '"connect.addressPlaceholder": "https://limix.example.com or'))

# 10e. No usage analytics at all (owner's decision 2026-11-12): the code shipped a PostHog key of the OpenMausBot project.
# analyticsEnabled() is always false, so posthog-js is never loaded and nothing is sent; the Settings row is gone; the
# key is blanked; docs/analytics.md is removed.
def no_analytics(s):
    if "Limix Bot never sends usage analytics" in s:
        return s
    s = must(s, 'const TOKEN = "phc_m2hP39w8y2gLPvHgDvSXAu6xcZ3agjf4ruL56rGcMZEe";', 'const TOKEN = ""; // Limix Bot never sends usage analytics')
    a = s.index("export function analyticsEnabled(): boolean {")
    b = s.index("\n}\n", a) + 3
    return s[:a] + "export function analyticsEnabled(): boolean {\n  void choice; // never on: Limix Bot sends no usage analytics\n  return false;\n}\n" + s[b:]
edit("src/lib/analytics.ts", no_analytics)
edit("src/components/AnalyticsRow.tsx", lambda s: s.replace("https://github.com/milind-soni/OpenMausBot/blob/main/docs/analytics.md", f"{REPO_URL}/blob/main/docs/analytics.md"))
edit("src/components/AnalyticsRow.tsx", lambda s: s if "no usage analytics row" in s else must(s, "export function AnalyticsRow({ simple = false }: { simple?: boolean }) {\n", "export function AnalyticsRow({ simple = false }: { simple?: boolean }) {\n  const off: boolean = true; // Limix Bot: no usage analytics row\n  if (off) return null;\n"))
_doc = ROOT / "docs/analytics.md"
if _doc.exists():
    _doc.unlink()
    changed.append("docs/analytics.md (removed)")

# 10f. Skills page of a bot: "Find on skills.sh" (https://www.skills.sh), "Limix Bot's built-in skills" (the library) and
# "Add skills from a folder on this computer" (works offline). Server: source "local-folder:<path>" reads that folder.
def skills_route(s):
    if "readLocalSkills" in s:
        return s
    s = must(s, 'import { fetchSkillFromSource } from "../skill-fetch.ts";', 'import { fetchSkillFromSource } from "../skill-fetch.ts";\nimport { readLocalSkills } from "../limix-skill-folder.ts";')
    return must(s, "      const fetched = await fetchSkillFromSource(parsed.data.source);",
        '      const fetched = parsed.data.source.startsWith("local-folder:") ? readLocalSkills(parsed.data.source.slice("local-folder:".length)) : await fetchSkillFromSource(parsed.data.source);')
edit("server/routes/bot-skills.ts", skills_route)

def skills_page(s):
    if "importFolder" in s:
        return s
    s = must(s, 'const SKILLS_SITE = "https://skills.sh";', 'const SKILLS_SITE = "https://www.skills.sh";')
    s = must(s, "  const browse = () => {\n    if (libraryOn) {",
        "  const importFolder = async () => {\n"
        "    const chosen = await window.ogb?.pickFolder?.();\n"
        "    if (!chosen || importing) return;\n"
        "    setImporting(true);\n    skills.setError(\"\");\n    setImported([]);\n"
        "    try {\n"
        "      const result = await api<{ imported?: SkillImportSummary[] }>(`/api/bots/${bot.id}/skills`, { method: \"POST\", body: JSON.stringify({ source: `local-folder:${chosen}` }) });\n"
        "      setImported(skillImportLines(result.imported ?? []));\n      await skills.refresh();\n"
        "    } catch (cause) {\n      skills.setError(errorText(cause, t(\"botPanel.skills.importFailed\")));\n    } finally {\n      setImporting(false);\n    }\n  };\n"
        "  const browse = () => {\n    if (libraryOn) {")
    s = must(s, '        <LinkRow data-panel-link="browse-skills" onClick={browse}>{t("botPanel.skills.browse")}</LinkRow>',
        '        <LinkRow data-panel-link="skills-sh" onClick={() => void openExternalLink(SKILLS_SITE)}>{t("botPanel.skills.skillsSh")}</LinkRow>\n'
        '        <LinkRow data-panel-link="browse-skills" onClick={browse}>{t("botPanel.skills.bundled")}</LinkRow>\n'
        '        {window.ogb?.pickFolder && <LinkRow data-panel-link="skills-folder" onClick={() => void importFolder()}>{t("botPanel.skills.fromFolder")}</LinkRow>}')
    return s
edit("src/components/bot-panel/pages.tsx", skills_page)

SKILL_KEYS_EN = {"botPanel.skills.skillsSh": "Find skills on skills.sh", "botPanel.skills.bundled": "Limix Bot's built-in skills", "botPanel.skills.fromFolder": "Add skills from a folder on this computer"}
def skill_keys(s):
    d = json.loads(s)
    if "botPanel.skills.skillsSh" in d:
        return s
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == "botPanel.skills.browse":
            out.update(SKILL_KEYS_EN)
    return json.dumps(out, indent=2, ensure_ascii=False) + "\n"
edit("src/locales/en.json", skill_keys)

# 10g. The Telegram / Zalo / Discord connector (limix/gateway) is part of the app: shipped in resources/limix-gateway,
# started after sign-in (electron/limix-gateway.mjs), opened from the account menu, stopped on quit.
def gw_builder(s):
    if "limix-gateway" in s:
        return s
    anchor = "    - from: limix-runtime\n      to: limix-runtime\n"
    add = "    - from: limix/gateway/src\n      to: limix-gateway/src\n    - from: limix/gateway/package.json\n      to: limix-gateway/package.json\n"
    return must(s, anchor, anchor + add)
edit("electron-builder.yml", gw_builder)

def gw_main(s):
    if "createLimixGateway" in s:
        return s
    s = must(s, 'import { limixRuntimeEnv } from "./limix-runtime.mjs";\n', 'import { limixRuntimeEnv } from "./limix-runtime.mjs";\nimport { createLimixGateway } from "./limix-gateway.mjs";\n')
    s = must(s, "app.whenReady().then(async () => {", "let limixGateway = null;\napp.whenReady().then(async () => {")
    gate = "  if (!(await limixAccountGate({ app, BrowserWindow, ipcMain, safeStorage, shell, dialog, iconPath: APP_ICON, log: slog, baseUrl: LIMIX_ACCOUNT_URL }))) { app.quit(); return; }\n"
    s = must(s, gate, gate + "  limixGateway = createLimixGateway({ app, BrowserWindow, shell, resourcesPath: process.resourcesPath, userData: app.getPath(\"userData\"), iconPath: APP_ICON, log: slog });\n  limixGateway.start();\n")
    return must(s, 'app.on("will-quit", releaseDesktopDataDirLease);',
        'ipcMain.handle("limix-gateway:open", localOnly("limix-gateway:open", () => limixGateway ? limixGateway.open() : Promise.reject(new Error(lxm("Chương trình kết nối chưa sẵn sàng.", "The connector program is not ready yet.")))));\n'
        'app.on("will-quit", () => limixGateway?.stop());\n'
        'app.on("will-quit", releaseDesktopDataDirLease);')
edit("electron/main.mjs", gw_main)
edit("electron/preload.cjs", lambda s: s if "limix-gateway:open" in s else must(s, '  pickFolder: (current) => ipcRenderer.invoke("desktop:pick-folder", current),\n', '  pickFolder: (current) => ipcRenderer.invoke("desktop:pick-folder", current),\n  limixGateway: { open: () => ipcRenderer.invoke("limix-gateway:open") },\n'))
edit("src/types/ogb.d.ts", lambda s: s if "limixGateway" in s else must(s, "      pickFolder?(current?: string): Promise<string | null>;\n", "      pickFolder?(current?: string): Promise<string | null>;\n      /** Limix Bot: opens the Telegram / Zalo / Discord connector window. */\n      limixGateway?: { open(): Promise<void> };\n"))

def gw_menu(s):
    if "connectItem" in s:
        return s
    s = must(s, "  Laptop,\n  LifeBuoy,\n", "  Laptop,\n  LifeBuoy,\n  Link2,\n")
    s = must(s, "  const settings: SidebarMenuItem = {", 
        "  const connectItem: SidebarMenuItem | null = typeof window !== \"undefined\" && window.ogb?.limixGateway ? {\n"
        "    key: \"connect\", label: t(\"sidebar.menu.connect\"), icon: <Link2 size={18} />,\n"
        "    onSelect: () => { void window.ogb?.limixGateway?.open().catch((error: unknown) => window.alert(String((error as Error)?.message ?? error).replace(/^Error invoking remote method '[^']*': (Error: )?/, \"\"))); },\n"
        "  } : null;\n  const settings: SidebarMenuItem = {")
    s = must(s, "...phone, support, settings,", "...phone, ...present(connectItem), support, settings,")
    return must(s, "    [...present(usageItem), settings],", "    [...present(usageItem), ...present(connectItem), settings],")
edit("src/components/SidebarProfileMenu.tsx", gw_menu)

def gw_keys(s):
    d = json.loads(s)
    if "sidebar.menu.connect" in d:
        return s
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == "sidebar.menu.feedback":
            out["sidebar.menu.connect"] = "Connect Telegram, Zalo, Discord"
    return json.dumps(out, indent=2, ensure_ascii=False) + "\n"
edit("src/locales/en.json", gw_keys)

# 10h. Lists of ways ("Wi-Fi, X and Y") follow the app language, not the Windows one: an English Windows printed "and".
def list_locale(s):
    s = must(s, 'new Intl.ListFormat(undefined, { type: "conjunction" })', 'new Intl.ListFormat(intlLocale(), { type: "conjunction" })')
    if "intlLocale" not in s.split("\n", 5)[1] and 'import { intlLocale, t } from "@/lib/i18n";' not in s:
        s = must(s, 'import { t } from "@/lib/i18n";', 'import { intlLocale, t } from "@/lib/i18n";')
    return s
edit("src/components/PhoneDevicesSection.tsx", list_locale)

# 10i. Instabox as the cloud computer service: an ibk_ key in the Boat key slot sends Boat's calls to Instabox
# (server/limix-instabox.ts translates them and answers in Boat's shape). Instabox machine ids are m_…, and a machine
# cannot be renamed, so the create carries the bot's computer name.
IB_ID = r"/^(?:bx_[23456789abcdefghjkmnpqrstuvwxyz]{8}|m_[a-z0-9]{20,40})$/"
def ib_ids(s):
    return must(s, "const BOAT_ID = /^bx_[23456789abcdefghjkmnpqrstuvwxyz]{8}$/;", f"const BOAT_ID = {IB_ID};")
for rel in ("server/boat.ts", "server/boat-create-idempotency.ts", "server/boat-delete-journal.ts"):
    edit(rel, ib_ids)

def ib_boat(s):
    if 'from "./limix-instabox.ts"' not in s:
        s = must(s, 'import { relayBody, relayPath } from "./boat-relay.ts";',
                 'import { relayBody, relayPath } from "./boat-relay.ts";\nimport { instaboxFetch, isInstaboxKey, verifyInstaboxKey } from "./limix-instabox.ts";')
    s = must(s, """  const account = boatAccount(cfg);
  return fetch(`${account?.api ?? boatProviderApi()}${relayPath(account, path)}`, {""",
             """  const account = boatAccount(cfg);
  if (isInstaboxKey(account?.token)) return instaboxFetch(account!.token, path, opts);
  return fetch(`${account?.api ?? boatProviderApi()}${relayPath(account, path)}`, {""")
    s = must(s, """export async function verifyToken(token: string): Promise<{ ok: true } | { ok: false; message: string; rejected?: true }> {
  try {""", """export async function verifyToken(token: string): Promise<{ ok: true } | { ok: false; message: string; rejected?: true }> {
  if (isInstaboxKey(token)) return verifyInstaboxKey(token);
  try {""")
    s = must(s, "  const body = JSON.stringify({ ttlSeconds, noEnv: true });",
             "  const body = JSON.stringify({ ttlSeconds, noEnv: true, ...(isInstaboxKey(boatAccount(cfg)?.token) ? { name: await boatNameFor(botId) } : {}) });")
    return s
edit("server/boat.ts", ib_boat)

def ib_catalog(s):
    s = must(s, 'name: "boat.dev", env: ["BOX_TOKEN"],\n    words: ["boat", "box",',
             'name: "boat.dev / Instabox", env: ["BOX_TOKEN"],\n    words: ["boat", "instabox", "box",')
    return must(s, 'placeholder: "boat_…", href: "https://docs.boat.dev/api-keys", analytics: "boat", shape: /^(boat|box)_/,',
                'placeholder: "boat_… / ibk_…", href: "https://docs.boat.dev/api-keys", analytics: "boat", shape: /^(boat|box|ibk)_/,')
edit("src/components/keys/key-catalog.ts", ib_catalog)

def ib_en(s):
    d = json.loads(s)
    d["keys.boat.label"] = "Boat or Instabox API key"
    d["keys.boat.placeholder"] = "Paste a Boat (boat_…) or Instabox (ibk_…) API key"
    d["vm.cloud.subtitle"] = "Your bots' cloud desktops, by Boat or Instabox. Deleting one erases it and its files for good."
    d["vm.cloud.needsKey"] = "Cloud desktops come from Boat or Instabox, both paid services. Paste a Boat or Instabox API key in Settings → API keys to create and manage them."
    d["vm.cloud.notConnected"] = "No Boat or Instabox key is connected."
    return json.dumps(d, indent=2, ensure_ascii=False) + "\n"
edit("src/locales/en.json", ib_en)

# 10j. Phone access without a phone app: Settings → Phone & devices shows a QR with a plain web link to this computer on
# the Wi-Fi (electron/limix-phone-browser.mjs turns on the server's LAN listener; the code signs that browser in once).
def pb_main(s):
    if "limix-phone-browser.mjs" not in s:
        s = must(s, 'import { createLimixGateway } from "./limix-gateway.mjs";\n',
                 'import { createLimixGateway } from "./limix-gateway.mjs";\nimport { limixPhoneBrowserEnv, limixPhoneBrowserOn, setLimixPhoneBrowser } from "./limix-phone-browser.mjs";\n')
    s = must(s, '    ...limixRuntimeEnv({ resourcesPath: process.resourcesPath, userData: app.getPath("userData") }),\n    OMB_DATA_DIR: dataDir,',
             '    ...limixRuntimeEnv({ resourcesPath: process.resourcesPath, userData: app.getPath("userData") }),\n'
             '    ...((lan) => { limixLanActive = Boolean(lan.OMB_LAN); return lan; })(limixPhoneBrowserEnv(app.getPath("userData"))),\n    OMB_DATA_DIR: dataDir,')
    if "let limixLanActive" in s:
        return s
    s = must(s, "let limixGateway = null;\n", "let limixGateway = null;\nlet limixLanActive = false;\n")
    return must(s, 'app.on("will-quit", () => limixGateway?.stop());\n',
        'app.on("will-quit", () => limixGateway?.stop());\n'
        'ipcMain.handle("limix-phone:state", localOnly("limix-phone:state", () => ({ on: limixPhoneBrowserOn(app.getPath("userData")), active: limixLanActive })));\n'
        'ipcMain.handle("limix-phone:set", localOnly("limix-phone:set", (_event, on) => { setLimixPhoneBrowser(app.getPath("userData"), on === true); app.relaunch(); app.quit(); }));\n')
edit("electron/main.mjs", pb_main)
edit("electron/preload.cjs", lambda s: s if "limix-phone:state" in s else must(s,
    '  limixGateway: { open: () => ipcRenderer.invoke("limix-gateway:open") },\n',
    '  limixGateway: { open: () => ipcRenderer.invoke("limix-gateway:open") },\n'
    '  limixPhone: { state: () => ipcRenderer.invoke("limix-phone:state"), set: (on) => ipcRenderer.invoke("limix-phone:set", on === true) },\n'))
edit("src/types/ogb.d.ts", lambda s: s if "limixPhone" in s else must(s,
    "      limixGateway?: { open(): Promise<void> };\n",
    "      limixGateway?: { open(): Promise<void> };\n      /** Limix Bot: this computer's Limix Bot in a phone browser on the same Wi-Fi. */\n"
    "      limixPhone?: { state(): Promise<{ on: boolean; active: boolean }>; set(on: boolean): Promise<void> };\n"))
def pb_section(s):
    if "LimixPhoneBrowser" not in s:
        s = must(s, 'import { useStore } from "@/state/store";\n',
                 'import { useStore } from "@/state/store";\nimport { LIMIX_PHONE_APPS_ENABLED } from "../../shared/limix-features";\nimport { LimixPhoneBrowser } from "./LimixPhoneBrowser";\n')
    head = 'export function PhoneDevicesSection({ profileEmail = "", focusRequest = 0, simple = false }: { profileEmail?: string; focusRequest?: number; simple?: boolean }) {\n'
    return must(s, head + "  const c = usePhoneSetupController(profileEmail);\n",
                head + "  if (!LIMIX_PHONE_APPS_ENABLED) return <LimixPhoneBrowser />;\n  const c = usePhoneSetupController(profileEmail);\n")
edit("src/components/PhoneDevicesSection.tsx", pb_section)

# 10k. The owner's own chat from Telegram / Zalo / Discord runs with any AI (server/limix-owner-lane.ts): the desktop
# app makes a per-launch secret for the server and the connector; a Bot API call carrying it is not confined.
def ol_host(s):
    if "limix-owner-lane" in s:
        return s
    s = must(s, 'import { bearerSecret, header, json, readRawBody, type IngressDoor } from "./webhook-ingress.ts";\n',
             'import { bearerSecret, header, json, readRawBody, type IngressDoor } from "./webhook-ingress.ts";\n'
             'import { isLimixOwnerThread, LIMIX_OWNER_HEADER, limixOwnerCall, markLimixOwnerThread } from "./limix-owner-lane.ts";\n')
    s = must(s, "  async function runCall(botId: string, call: z.output<typeof callSchema>, turnStarted: () => void): Promise<{ status: number; body: BotApiReply }> {\n",
             "  async function runCall(botId: string, call: z.output<typeof callSchema>, turnStarted: () => void, owner = false): Promise<{ status: number; body: BotApiReply }> {\n")
    s = must(s, "      if (!task || task.botApi !== true) fail(404, \"no such thread\");\n      if (deps.threadBusy(botId, threadId))",
             "      if (!task || task.botApi !== true || isLimixOwnerThread(threadId) !== owner) fail(404, \"no such thread\");\n      if (deps.threadBusy(botId, threadId))")
    s = must(s, "      store.patchTask(botId, threadId, { botApi: true, outside: true });\n",
             "      store.patchTask(botId, threadId, { botApi: true, outside: true });\n      if (owner) markLimixOwnerThread(threadId);\n")
    s = must(s, "      if (!deps.canConfine(botId)) {\n", "      const limixOwner = limixOwnerCall(req.headers[LIMIX_OWNER_HEADER]);\n      if (!limixOwner && !deps.canConfine(botId)) {\n")
    s = must(s, "        if (!task || task.botApi !== true) { json(res, 404, { error: \"no such thread\" }); return true; }\n",
             "        if (!task || task.botApi !== true || isLimixOwnerThread(threadId) !== limixOwner) { json(res, 404, { error: \"no such thread\" }); return true; }\n")
    return must(s, "        const answer = await runCall(botId, call, release);\n", "        const answer = await runCall(botId, call, release, limixOwner);\n")
edit("server/bot-api-host.ts", ol_host)

def ol_index(s):
    if "isLimixOwnerThread" in s:
        return s
    s = must(s, "function botApiThread(id: string): boolean { const owner = store.botByThread(id); return Boolean(owner && store.taskByThread(owner.id, id)?.botApi); }",
             "function botApiThread(id: string): boolean { const owner = store.botByThread(id); return Boolean(owner && store.taskByThread(owner.id, id)?.botApi) && !isLimixOwnerThread(id); }")
    return must(s, 'import { captureRecentLog } from "./recent-log.ts";',
                'import { captureRecentLog } from "./recent-log.ts"; import { isLimixOwnerThread } from "./limix-owner-lane.ts";')
edit("server/index.ts", ol_index)

def ol_main(s):
    if "LIMIX_OWNER_LANE_TOKEN" in s:
        return s
    s = must(s, "let limixGateway = null;\n", "let limixGateway = null;\nconst limixOwnerLaneToken = randomBytes(32).toString(\"base64url\");\n")
    s = must(s, '    OMB_DESKTOP_PARENT: "1",\n', '    OMB_DESKTOP_PARENT: "1",\n    LIMIX_OWNER_LANE_TOKEN: limixOwnerLaneToken,\n')
    return must(s, "iconPath: APP_ICON, log: slog });\n  limixGateway.start();", "iconPath: APP_ICON, log: slog, ownerLaneToken: limixOwnerLaneToken });\n  limixGateway.start();")
edit("electron/main.mjs", ol_main)

# 10l. The Boat / Instabox key row links to both providers' key pages.
def ib_links_type(s):
    if "serviceLinks?:" in s:
        return s
    return must(s, "  href?: string;\n  test?: TestableProvider;\n",
                "  href?: string;\n  /** Limix Bot: one key page per service a row takes (Boat and Instabox), each named. */\n"
                "  serviceLinks?: ReadonlyArray<{ service: string; href: string }>;\n  test?: TestableProvider;\n")
def ib_links_catalog(s):
    s = ib_links_type(s)
    return must(s, 'shape: /^(boat|box|ibk)_/, warningKey: "keys.boat.warning" } },',
                'shape: /^(boat|box|ibk)_/, warningKey: "keys.boat.warning",\n      serviceLinks: [{ service: "Boat", href: "https://docs.boat.dev/api-keys" }, { service: "Instabox", href: "https://dashboard.instabox.sh/dashboard/api-keys" }] } },')
edit("src/components/keys/key-catalog.ts", ib_links_catalog)
def ib_links_row(s):
    if "target.serviceLinks" in s:
        return s
    old = """                {fieldShown && target.href && (
                  <a href={target.href} target="_blank" rel="noopener noreferrer" onClick={() => { if (via === "settings") target.settingsEvent?.("get_key"); }} className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
                    {t("keys.row.getKey")}
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                )}
"""
    new = """                {fieldShown && target.href && !target.serviceLinks && (
                  <a href={target.href} target="_blank" rel="noopener noreferrer" onClick={() => { if (via === "settings") target.settingsEvent?.("get_key"); }} className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
                    {t("keys.row.getKey")}
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                )}
                {fieldShown && target.serviceLinks?.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
                    {t("hostedMcp.getKey", { service: link.service })}
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                ))}
"""
    return must(s, old, new)
edit("src/components/keys/KeyRow.tsx", ib_links_row)
def ib_warn(s):
    d = json.loads(s)
    d["keys.boat.warning"] = "Boat and Instabox are paid services after their free allowance. Usage may incur charges."
    return json.dumps(d, indent=2, ensure_ascii=False) + "\n"
edit("src/locales/en.json", ib_warn)

# 10m. A pasted key keeps no stray spaces, and the "not a Boat key" message names Instabox's ibk_ keys too.
def ib_messages(s):
    return must(s, "\"That doesn't look like a Boat API key: they start with boat_ (older ones with box_). Copy the API key from your boat.dev account (an account or session token won't work here).\",",
                "\"That isn't a Boat or Instabox API key: Boat keys start with boat_ (older ones with box_), Instabox keys with ibk_. Copy the whole key, first letters included.\",")
edit("server/boat.ts", ib_messages)

# 10n. An Instabox refusal is shown in Instabox's own words, never as "boat.dev rejected your key".
def ib_error_words(s):
    head = "export function boatErrorMessage(status: number, what: string, body?: any, included = false): string {\n"
    if "Instabox:" in s:
        return s
    return must(s, head, head + '  if (typeof body?.message === "string" && body.message.startsWith("Instabox:")) return `${what} failed. ${body.message}`;\n')
edit("server/boat.ts", ib_error_words)

# 10o. The connector lists the app's bots and gets a bot's Bot API address and key through the app (no copying).
edit("electron/main.mjs", lambda s: s if "serverRequest: (route, init)" in s else must(s,
    "ownerLaneToken: limixOwnerLaneToken });\n  limixGateway.start();",
    "ownerLaneToken: limixOwnerLaneToken, serverRequest: (route, init) => localServerRequest(route, init) });\n  limixGateway.start();"))

# 10p. The slow-first-reply row also prints its tool name as a sentence: in Limix Bot that sentence is Vietnamese.
def rescue_words(s):
    if "limixVi()" in s:  # 11f made these follow the app language
        return s
    s = must(s, "  return `notice: ${botName} hasn't heard back from ${ai} yet.`;", "  return `notice: ${botName} vẫn chưa nhận được phản hồi từ ${ai}.`;")
    s = must(s, "  return `notice: ${botName} didn't hear back from ${ai}.`;", "  return `notice: ${botName} không nhận được phản hồi từ ${ai}.`;")
    return must(s, "  return `notice: ${ai} answered after a slow start.`;", "  return `notice: ${ai} đã trả lời, sau một lúc chậm.`;")
edit("shared/first-reply-rescue.ts", rescue_words)

# 10q. The tray icon is the light mark: the black app icon disappears on Windows' dark tray.
edit("electron/main.mjs", lambda s: s if "limix-tray.png" in s else must(s,
    "        Tray, Menu, nativeImage, iconPath: APP_ICON, t: nativeT,\n",
    "        Tray, Menu, nativeImage, iconPath: path.join(__dirname, \"resources/limix-tray.png\"), t: nativeT,\n"))

# 10r. A main window whose page process died (killed in Task Manager, a GPU reset) loads its page again instead of
# staying black; the app process itself is still running, so nothing else would bring the page back.
edit("electron/main.mjs", lambda s: s if "limix: main window page went away" in s else must(s,
    'app.on("will-quit", () => limixGateway?.stop());\n',
    'app.on("will-quit", () => limixGateway?.stop());\n'
    'app.on("render-process-gone", (_event, contents, details) => {\n'
    '  if (desktopShutdownStarted || details?.reason === "clean-exit" || !mainWindow || mainWindow.isDestroyed() || contents !== mainWindow.webContents) return;\n'
    '  slog(`limix: main window page went away (${details?.reason}); loading it again`);\n'
    '  setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload(); }, 1_000);\n'
    '});\n'))

# 10s. A cloud computer says which bot it belongs to, in words ("Máy của bot X"), and its machine id is a small line.
def cc_label(s):
    if "vm.cloud.ofBot" in s:
        return s
    s = must(s, '{instance.orphaned ? t("vm.cloud.orphan") : instance.ownerName}',
             '{instance.orphaned ? t("vm.cloud.orphan") : t("vm.cloud.ofBot", { name: instance.ownerName ?? "" })}')
    return must(s, '{instance.orphaned ? t("vm.owner.gone") : t("vm.owner.owned")} · {instance.name}\n                </div>\n                {instance.inUse && (\n                  <div className="mt-1 text-[12px] text-ink-secondary">{t("vm.cloud.stopFirst")}',
                '{instance.orphaned ? t("vm.owner.gone") : t("vm.cloud.machineId", { id: instance.name })}\n                </div>\n                {instance.inUse && (\n                  <div className="mt-1 text-[12px] text-ink-secondary">{t("vm.cloud.stopFirst")}')
edit("src/components/LocalComputerSection.tsx", cc_label)
edit("src/components/LocalComputerSection.tsx", lambda s: must(s,
    "done={!perBot && ready}",
    "done={perBot ? inventory.some((instance) => instance.managed) : ready}"))
def cc_en(s):
    d = json.loads(s)
    d["vm.cloud.ofBot"] = "Computer of bot {name}"
    d["vm.cloud.machineId"] = "Machine ID: {id}"
    return json.dumps(d, indent=2, ensure_ascii=False) + "\n"
edit("src/locales/en.json", cc_en)

# 10t. "Connect your phone" opens a window in the middle of the screen (LimixPhoneDialog) instead of a page inside Settings.
def phone_dialog(s):
    if "LimixPhoneDialog" in s:
        return s
    s = must(s, 'import { PhoneAppDialog } from "./lazy-screens";\n', 'import { PhoneAppDialog } from "./lazy-screens";\nimport { LimixPhoneDialog } from "./LimixPhoneDialog";\n')
    s = must(s, "  const [phoneAppOpen, setPhoneAppOpen] = useState(false);\n", "  const [phoneAppOpen, setPhoneAppOpen] = useState(false);\n  const [limixPhoneOpen, setLimixPhoneOpen] = useState(false);\n")
    s = must(s, "  const connectTo = (destination: PhoneDestination) => selectPhoneDestination(destination, { bridge: cloudPhone.bridge, dispatch });",
             "  const connectTo = (destination: PhoneDestination) => LIMIX_PHONE_APPS_ENABLED ? selectPhoneDestination(destination, { bridge: cloudPhone.bridge, dispatch }) : setLimixPhoneOpen(true);")
    return must(s, "      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />\n",
                "      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />\n      {limixPhoneOpen && <LimixPhoneDialog onClose={() => setLimixPhoneOpen(false)} />}\n")
edit("src/components/SidebarProfileMenu.tsx", phone_dialog)

# 10u. The tray icon follows the app's theme (Settings: light / dark / system): white on dark, near-black on light.
def tray_theme(s):
    if "setLight" in s:
        return s
    s = must(s, "export function createSystemTray({ Tray, Menu, nativeImage, iconPath, getWindow, onQuit, t = nativeText.englishText.t }) {\n  const tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 }),",
             "export function createSystemTray({ Tray, Menu, nativeImage, iconPath, lightIconPath = iconPath, light = false, getWindow, onQuit, t = nativeText.englishText.t }) {\n"
             "  const image = (onLight) => nativeImage.createFromPath(onLight ? lightIconPath : iconPath).resize({ width: 20, height: 20 });\n"
             "  let shownLight = light;\n"
             "  const tray = new Tray(image(light),")
    return must(s, "    relabel() { if (!tray.isDestroyed()) label(); },\n",
                "    relabel() { if (!tray.isDestroyed()) label(); },\n"
                "    setLight(onLight) { if (tray.isDestroyed() || onLight === shownLight) return; shownLight = onLight; tray.setImage(image(onLight)); },\n")
edit("electron/system-tray.mjs", tray_theme)
def tray_main(s):
    if "limix-tray-light.png" in s:
        return s
    s = must(s, 'import { isKnownSkin, skinChrome } from "./skin-overlay.cjs";', 'import { isKnownSkin, skinChrome, skinIsLight } from "./skin-overlay.cjs";')
    s = must(s, '        Tray, Menu, nativeImage, iconPath: path.join(__dirname, "resources/limix-tray.png"), t: nativeT,\n',
             '        Tray, Menu, nativeImage, iconPath: path.join(__dirname, "resources/limix-tray.png"), lightIconPath: path.join(__dirname, "resources/limix-tray-light.png"), light: !nativeTheme.shouldUseDarkColors, t: nativeT,\n')
    return must(s, "    talk.skin(skin); const { color } = skinChrome(skin);\n",
                "    talk.skin(skin); const { color } = skinChrome(skin);\n    if (mainWindow && event.sender === mainWindow.webContents) desktopTray?.setLight?.(skinIsLight(skin));\n")
edit("electron/main.mjs", tray_main)

# 10v. "Công cụ cho kỹ năng": one-click install of what the default skills, the private computer (Docker) and the
# suggested rea MCP need (electron/limix-tools.mjs, LimixToolsDialog); asked once on a new computer. Settings > Skills
# also lists the skills that ship with the app (LimixBundledSkills, GET /api/limix/bundled-skills).
def tools_route(s):
    if "/api/limix/bundled-skills" in s:
        return s
    s = must(s, 'import { readLocalSkills } from "../limix-skill-folder.ts";\n', 'import { readLocalSkills } from "../limix-skill-folder.ts";\nimport { loadBundledSkills } from "../skill-library.ts";\n')
    return must(s, "    let m: RegExpMatchArray | null = null;\n",
                "    let m: RegExpMatchArray | null = null;\n"
                "    if (method === \"GET\" && path === \"/api/limix/bundled-skills\") {\n"
                "      const skills = loadBundledSkills().map(({ manifest }) => ({ id: manifest.id, name: manifest.name, description: manifest.description, defaultEnabled: manifest.defaultEnabled, triggerTerms: manifest.triggerTerms }));\n"
                "      return json(res, 200, { skills });\n"
                "    }\n")
edit("server/routes/bot-skills.ts", tools_route)
def tools_settings(s):
    if "LimixBundledSkills" in s:
        return s
    s = must(s, 'import { Card, Switch } from "./SettingsPrimitives";\n', 'import { Card, Switch } from "./SettingsPrimitives";\nimport { LimixBundledSkills } from "./LimixBundledSkills";\n')
    return must(s, '    <div className="flex flex-col gap-4">\n      <Card title={t("skills.library.title")}', '    <div className="flex flex-col gap-4">\n      <LimixBundledSkills />\n      <Card title={t("skills.library.title")}')
edit("src/components/SkillsSection.tsx", tools_settings)
# 10w. Limix Skill Hub client (server/limix-skill-hub.ts, LimixSkillHub card in Settings > Skills): catalog sync,
# SHA-256 pinned installs that land disabled, Auto Sync on / Auto Install off.
def hub_route(s):
    if "handleLimixHub" in s:
        return s
    s = must(s, 'import { loadBundledSkills } from "../skill-library.ts";\n', 'import { loadBundledSkills } from "../skill-library.ts";\nimport { handleLimixHub } from "../limix-skill-hub.ts";\n')
    return must(s, "    let m: RegExpMatchArray | null = null;\n",
                "    let m: RegExpMatchArray | null = null;\n"
                "    if (path.startsWith(\"/api/limix/hub\")) {\n"
                "      const hub = await handleLimixHub(method, path, method === \"POST\" ? await readBody(req) : undefined);\n"
                "      if (hub) return json(res, hub.status, hub.body);\n"
                "    }\n")
edit("server/routes/bot-skills.ts", hub_route)
def hub_index(s):
    if "startHubAutoSync" in s:
        return s
    s = must(s, 'import { createBotSkillsRoutes } from "./routes/bot-skills.ts";\n', 'import { createBotSkillsRoutes } from "./routes/bot-skills.ts";\nimport { startHubAutoSync } from "./limix-skill-hub.ts";\n')
    return must(s, "ROUTES.push(createBotSkillsRoutes({ store, cfg, listBotSkills, readBotSkillFile, stagedSkillListing }));\n",
                "ROUTES.push(createBotSkillsRoutes({ store, cfg, listBotSkills, readBotSkillFile, stagedSkillListing }));\nstartHubAutoSync();\n")
edit("server/index.ts", hub_index)
def hub_settings(s):
    if "LimixSkillHub" in s:
        return s
    s = must(s, 'import { LimixBundledSkills } from "./LimixBundledSkills";\n', 'import { LimixBundledSkills } from "./LimixBundledSkills";\nimport { LimixSkillHub } from "./LimixSkillHub";\n')
    return must(s, "      <LimixBundledSkills />\n", "      <LimixBundledSkills />\n      <LimixSkillHub />\n")
edit("src/components/SkillsSection.tsx", hub_settings)

# 10x. Windows 10: the "new chat" menu is as wide as its longest line, so a long bot name pushed it past the left edge
# of the sidebar and cut the text. Cap its width and truncate the bot name.
def plus_menu_width(s):
    if "max-w-[min(18rem" in s:
        return s
    s = must(s, '"absolute z-40 w-max min-w-[200px] overflow-hidden", MENU_SHEET,', '"absolute z-40 w-max min-w-[200px] max-w-[min(18rem,calc(100vw-2rem))] overflow-hidden", MENU_SHEET,')
    return must(s, '{t("sidebar.newConversationWith", { name: plusBot.name })}</button>', '<span className="min-w-0 truncate">{t("sidebar.newConversationWith", { name: plusBot.name })}</span></button>')
edit("src/components/Sidebar.tsx", plus_menu_width)

# 10y. Antigravity fast lane: the first Antigravity AI uses Google's Antigravity CLI (`agy acp`, signed in through the
# OS keyring) when it is installed; others keep the managed runtime (server/limix-agy-cli.ts).
def agy_cli(s):
    if "agyCliFor" in s:
        return s
    s = must(s, 'import { augmentedPath } from "../env-path.ts";\n', 'import { augmentedPath } from "../env-path.ts";\nimport { agyCliFor, releaseAgyCli } from "../limix-agy-cli.ts";\n')
    s = must(s, "  resolveCommand: async (env, config, instanceId) => {\n",
                "  resolveCommand: async (env, config, instanceId) => {\n    const agyCli = agyCliFor(instanceId, env);\n    if (agyCli) return { command: agyCli, args: [\"acp\"] };\n")
    s = must(s, "  resolveModels: async (env, config, instanceId) => {\n",
                "  resolveModels: async (env, config, instanceId) => {\n    if (agyCliFor(instanceId, env)) return currentEngineCatalog(\"antigravity\");\n")
    s = must(s, "  isAuthenticated: async (env, config, instanceId) => {\n",
                "  isAuthenticated: async (env, config, instanceId) => {\n    if (agyCliFor(instanceId, env)) return true;\n")
    s = must(s, "  snapshot: async (env, config, instanceId): Promise<ProviderSnapshot> => {\n",
                "  snapshot: async (env, config, instanceId): Promise<ProviderSnapshot> => {\n    if (agyCliFor(instanceId, env)) return { state: \"available\", version: \"Antigravity CLI\", authenticated: true };\n")
    return must(s, "        await removeAntigravitySignIn(input.instanceId);\n",
                "        await removeAntigravitySignIn(input.instanceId);\n        releaseAgyCli(input.instanceId);\n")
edit("server/drivers/antigravity.ts", agy_cli)

# 10z. Simple mode: Skills is its own page in Settings, right under AI (it was hidden among "more settings").
def skills_page(s):
    if '{ id: "skills", labelKey: "settings.section.skills"' in s:
        return s
    s = must(s, '  { id: "ai", labelKey: "settings.group.ai", icon: Sparkles, sections: ["engines", "connections"], keywords: ["new bots", "defaults", "effort"] },\n',
                '  { id: "ai", labelKey: "settings.group.ai", icon: Sparkles, sections: ["engines", "connections"], keywords: ["new bots", "defaults", "effort"] },\n'
                '  { id: "skills", labelKey: "settings.section.skills", icon: BookOpen, sections: ["skills"], keywords: ["skills", "skill hub", "library", "kỹ năng", "thư viện"] },\n')
    return must(s, '["backups", "experimental", "workspaces", "skills", "decisionModel", "imageGeneration"]', '["backups", "experimental", "workspaces", "decisionModel", "imageGeneration"]')
edit("src/components/SettingsModal.tsx", skills_page)

# 10z2. "Công cụ cho kỹ năng" is a card at the top of Settings > Skills (it left the account menu).
def tools_card(s):
    if "LimixToolsCard" in s:
        return s
    s = must(s, 'import { LimixBundledSkills } from "./LimixBundledSkills";\n', 'import { LimixBundledSkills, LimixToolsCard } from "./LimixBundledSkills";\n')
    return must(s, "      <LimixBundledSkills />\n", "      <LimixToolsCard />\n      <LimixBundledSkills />\n")
edit("src/components/SkillsSection.tsx", tools_card)

# 10z3. Remote (4G) in a phone browser: the tunnel ends at the companion's private origin, which only speaks to the native
# app. Browser requests there go on to the app server's tunnel listener (companion/src/limix-web.ts, OMB_TUNNEL_SOCKET).
def web_origin_companion(s):
    if "isLimixWebRequest" in s:
        return s
    s = must(s, 'import { createServer } from "node:http";\n', 'import { createServer } from "node:http";\nimport { forwardToLimixWeb, forwardUpgradeToLimixWeb, isLimixWebRequest } from "./limix-web.ts";\n')
    return must(s,
        'const managedOrigin = PRIVATE_ORIGIN ? createServer(gzipTunnelReplies((req, res) => proxy(req, res, "origin"))) : null;\n'
        'managedOrigin?.on("upgrade", (req, socket, head) => proxy.upgrade(req, socket, head, "origin"));\n',
        'const limixOriginReplies = gzipTunnelReplies((req, res) => proxy(req, res, "origin"));\n'
        'const managedOrigin = PRIVATE_ORIGIN ? createServer((req, res) => (isLimixWebRequest(req) ? forwardToLimixWeb(req, res) : limixOriginReplies(req, res))) : null;\n'
        'managedOrigin?.on("upgrade", (req, socket, head) => (isLimixWebRequest(req) ? forwardUpgradeToLimixWeb(req, socket, head) : proxy.upgrade(req, socket, head, "origin")));\n')
edit("companion/src/index.ts", web_origin_companion)
def web_origin_env(s):
    if "LIMIX_WEB_ORIGIN" in s:
        return s
    s = must(s, "  childEnvironment.OMB_COMPANION_INTERNAL_ORIGIN = allocatedOrigin.socketPath;\n",
                "  childEnvironment.OMB_COMPANION_INTERNAL_ORIGIN = allocatedOrigin.socketPath;\n  childEnvironment.LIMIX_WEB_ORIGIN = limixWebSocketPath();\n")
    first_import = s.index("import ")
    return s[:first_import] + 'import { limixWebSocketPath } from "./limix-phone-browser.mjs";\n' + s[first_import:]
edit("electron/companion.mjs", web_origin_env)

# 10z4. Google's Antigravity CLI (`agy acp`, the fast lane) names its permission modes differently from the managed
# runtime: pick the value the session offers for the same meaning, and skip the switch when it offers none.
def agy_modes(s):
    if "limixModeFor" in s:
        return s
    s = must(s, "    const wanted = antigravityPermissionMode(config.fullAuto, turn.approvalMode);\n    const result = await request(\"session/set_config_option\", {\n",
                "    const wanted = limixModeFor(antigravityPermissionMode(config.fullAuto, turn.approvalMode), configOptions.find((option: any) => option?.id === \"mode\"));\n"
                "    if (!wanted) return;\n"
                "    const result = await request(\"session/set_config_option\", {\n")
    return must(s, "const managedAsset = resolveAntigravityReleaseAsset();\n",
                "const managedAsset = resolveAntigravityReleaseAsset();\n\n"
                "const LIMIX_MODE_ALIASES: Record<string, string[]> = {\n"
                "  yolo: [\"yolo\", \"bypassPermissions\", \"bypass_permissions\", \"full\", \"auto\", \"autoEdit\", \"auto_edit\", \"acceptEdits\"],\n"
                "  auto_edit: [\"auto_edit\", \"autoEdit\", \"acceptEdits\", \"accept_edits\"],\n"
                "  default: [\"default\", \"ask\", \"normal\"],\n"
                "};\n\n"
                "/** The mode value this session offers for `wanted`; null when it offers none (the session keeps its own). */\n"
                "function limixModeFor(wanted: string, option: any): string | null {\n"
                "  const offered: string[] = [];\n"
                "  const collect = (list: unknown): void => {\n"
                "    if (!Array.isArray(list)) return;\n"
                "    for (const item of list) {\n"
                "      if (item && typeof item === \"object\" && Array.isArray((item as any).options)) collect((item as any).options);\n"
                "      const value = item && typeof item === \"object\" ? (item as any).value ?? (item as any).id : item;\n"
                "      if (typeof value === \"string\") offered.push(value);\n"
                "    }\n"
                "  };\n"
                "  collect(option?.options);\n"
                "  if (offered.length === 0) return wanted;\n"
                "  return (LIMIX_MODE_ALIASES[wanted] ?? [wanted]).find((value) => offered.includes(value)) ?? null;\n"
                "}\n")
edit("server/drivers/antigravity.ts", agy_modes)

def tools_main(s):
    if "limix-tools.mjs" in s:
        return s
    s = must(s, 'import { createLimixGateway } from "./limix-gateway.mjs";\n', 'import { createLimixGateway } from "./limix-gateway.mjs";\nimport { createLimixTools } from "./limix-tools.mjs";\n')
    s = must(s, "  limixGateway.start();\n", "  limixGateway.start();\n  limixTools = createLimixTools({ userData: app.getPath(\"userData\"), resourcesPath: process.resourcesPath, serverRequest: (route, init) => localServerRequest(route, init), log: slog });\n")
    return must(s, 'app.on("will-quit", () => limixGateway?.stop());\n',
                'app.on("will-quit", () => limixGateway?.stop());\n'
                'let limixTools = null;\n'
                'ipcMain.handle("limix-tools:state", localOnly("limix-tools:state", () => limixTools ? limixTools.state() : { supported: false, items: [] }));\n'
                'ipcMain.handle("limix-tools:install", localOnly("limix-tools:install", (_event, ids) => limixTools ? limixTools.install(Array.isArray(ids) ? ids.map(String) : []) : { supported: false, items: [] }));\n'
                'ipcMain.handle("limix-tools:should-ask", localOnly("limix-tools:should-ask", () => limixTools ? limixTools.shouldAsk() : false));\n'
                'ipcMain.handle("limix-tools:asked", localOnly("limix-tools:asked", () => limixTools?.markAsked()));\n')
edit("electron/main.mjs", tools_main)
edit("electron/preload.cjs", lambda s: s if "limix-tools:state" in s else must(s,
    '  limixGateway: { open: () => ipcRenderer.invoke("limix-gateway:open") },\n',
    '  limixGateway: { open: () => ipcRenderer.invoke("limix-gateway:open") },\n'
    '  limixTools: { state: () => ipcRenderer.invoke("limix-tools:state"), install: (ids) => ipcRenderer.invoke("limix-tools:install", ids), shouldAsk: () => ipcRenderer.invoke("limix-tools:should-ask"), markAsked: () => ipcRenderer.invoke("limix-tools:asked") },\n'))
def tools_menu(s):
    if "limix:tools-open" in s:
        return s
    # 0.3.21: no menu item any more; the tools live in Settings > Skills (LimixToolsCard). The ask-once dialog stays.
    s = must(s, 'import { LimixPhoneDialog } from "./LimixPhoneDialog";\n', 'import { LimixPhoneDialog } from "./LimixPhoneDialog";\nimport { LimixToolsDialog, limixTools } from "./LimixToolsDialog";\n')
    s = must(s, "  const [limixPhoneOpen, setLimixPhoneOpen] = useState(false);\n",
             "  const [limixPhoneOpen, setLimixPhoneOpen] = useState(false);\n"
             "  const [limixToolsOpen, setLimixToolsOpen] = useState<null | { asking: boolean }>(null);\n"
             "  useEffect(() => {\n"
             "    const open = () => setLimixToolsOpen({ asking: false });\n"
             "    window.addEventListener(\"limix:tools-open\", open);\n"
             "    // A new computer: ask once, a little after start, whether to install what the default skills need.\n"
             "    const timer = setTimeout(() => { void limixTools()?.shouldAsk().then((ask) => { if (ask) setLimixToolsOpen((now) => now ?? { asking: true }); }).catch(() => undefined); }, 8000);\n"
             "    return () => { window.removeEventListener(\"limix:tools-open\", open); clearTimeout(timer); };\n"
             "  }, []);\n")
    return must(s, "      {limixPhoneOpen && <LimixPhoneDialog onClose={() => setLimixPhoneOpen(false)} />}\n",
                "      {limixPhoneOpen && <LimixPhoneDialog onClose={() => setLimixPhoneOpen(false)} />}\n"
                "      {limixToolsOpen && <LimixToolsDialog asking={limixToolsOpen.asking} onClose={() => setLimixToolsOpen(null)} />}\n")
edit("src/components/SidebarProfileMenu.tsx", tools_menu)

# 10z5. Tools: "Quét" re-reads this computer (current Windows PATH, winget/choco/scoop folders) so tools the person already
# installed count as present; the bridge gains scan().
def tools_scan(s):
    if "limix-tools:scan" in s:
        return s
    return must(s, 'ipcMain.handle("limix-tools:should-ask"', 'ipcMain.handle("limix-tools:scan", localOnly("limix-tools:scan", () => limixTools ? limixTools.scan() : { supported: false, items: [] }));\nipcMain.handle("limix-tools:should-ask"')
edit("electron/main.mjs", tools_scan)
edit("electron/preload.cjs", lambda s: s if "limix-tools:scan" in s else must(s, 'state: () => ipcRenderer.invoke("limix-tools:state"), ', 'state: () => ipcRenderer.invoke("limix-tools:state"), scan: () => ipcRenderer.invoke("limix-tools:scan"), '))

# 10z6. Settings window (Simple mode) can be resized by dragging its edges, within a minimum and the app window.
def settings_resize(s):
    if "LimixResizeHandles" in s:
        return s
    s = s.replace('\nimport ', '\nimport { LimixResizeHandles } from "./LimixResizeHandles";\nimport ', 1)
    return must(s, '          <span id="app-settings-title" className="sr-only">{t("settings.title")}</span>\n          <nav aria-label',
                '          <span id="app-settings-title" className="sr-only">{t("settings.title")}</span>\n          <LimixResizeHandles />\n          <nav aria-label')
edit("src/components/SettingsModal.tsx", settings_resize)

# 10z7. The "new chat" menu opens leftwards from the + button; in a narrow sidebar (Windows 10 at 100-125 %) it still ran
# past the sidebar's clipped left edge. On open it narrows itself to the space left of the button.
def plus_menu_clamp(s):
    if "limixClampMenu" in s:
        return s
    s = must(s, '        <div role="menu" aria-label={remoteClient ? t("sidebar.new") : t("sidebar.newOrShare")} onKeyDown={navigateThreadMenu} className={cn(\n',
                '        <div ref={rail ? undefined : limixClampMenu} role="menu" aria-label={remoteClient ? t("sidebar.new") : t("sidebar.newOrShare")} onKeyDown={navigateThreadMenu} className={cn(\n')
    s = s.replace("\nexport function Sidebar(", "\n/** Limix: keep a right-aligned menu inside the nearest clipping box (and the window). */\n"
        "function limixClampMenu(el: HTMLDivElement | null): void {\n"
        "  if (!el) return;\n"
        "  let left = 0;\n"
        "  for (let node = el.parentElement; node; node = node.parentElement) {\n"
        "    const style = getComputedStyle(node);\n"
        "    if (style.overflowX !== \"visible\" || style.overflow !== \"visible\") { left = Math.max(0, node.getBoundingClientRect().left); break; }\n"
        "  }\n"
        "  const right = el.getBoundingClientRect().right;\n"
        "  const room = right - left - 8;\n"
        "  if (room > 0 && el.offsetWidth > room) { el.style.minWidth = \"0\"; el.style.maxWidth = `${Math.floor(room)}px`; }\n"
        "}\n\nexport function Sidebar(", 1)
    if "function limixClampMenu" not in s:
        raise SystemExit("rebrand: Sidebar export not found")
    return s
edit("src/components/Sidebar.tsx", plus_menu_clamp)

# 10z8. Whenever the full sidebar would leave the chat too little room (any resolution, Windows scaling or app zoom:
# limix/overlay/src/lib/limix-sidebar-fit.ts measures in CSS pixels on every resize and zoom), the sidebar shows its
# column of avatars, the way it already did with a side panel open, instead of cutting its names and menus.
def narrow_icons(s):
    if "useLimixSidebarFits" in s:
        return s
    s = s.replace("\nimport ", '\nimport { useLimixSidebarFits } from "./lib/limix-sidebar-fit";\nimport ', 1)
    s = must(s, "  const advanced = useAdvancedMode();\n",
                "  const advanced = useAdvancedMode();\n  const limixSidebarFits = useLimixSidebarFits(!advanced);\n")
    return must(s, "  const collapseSidebar = sidePanelOpen && !sidebarAndPanelFit;\n",
                "  const collapseSidebar = (sidePanelOpen && !sidebarAndPanelFit) || (sidebarInline && !limixSidebarFits);\n")
edit("src/App.tsx", narrow_icons)

# 11a. The first greeting, the "tell me what you need" line and the starting choices in Vietnamese, and the server
# told the language picked in the desktop app (it only knew Settings > Language on the server or the system's).
VI_GREETING = '  vi: (name, person) => `Xin chào${person ? ` ${person}` : ""}, mình là ${name}. Bạn muốn mình giúp việc gì?`,\n'
VI_SETUP_LINE = '  vi: "Tuyệt. Bạn cứ kể bằng lời của mình về việc cần giúp, mình sẽ tự thiết lập để làm việc đó. Ví dụ: \\"sắp xếp hộp thư của tôi mỗi sáng\\" hoặc \\"tìm hiểu đối thủ của chúng tôi mỗi tuần\\".",\n'
VI_CHOICES = ('  vi: ["Nghiên cứu và tìm hiểu sâu một chủ đề", "Theo dõi mọi việc giúp tôi", "Email, lịch và tin nhắn",\n'
              '    "Đặt chỗ, mua sắm và việc vặt", "Dữ liệu, bảng tính và báo cáo"],\n')
def vi_greeting(s):
    if VI_GREETING in s:
        return s
    s = must(s, '  "zh-tw": (name, person) => `嗨', VI_GREETING + '  "zh-tw": (name, person) => `嗨')
    s = must(s, '  "zh-tw": "好的。', VI_SETUP_LINE + '  "zh-tw": "好的。')
    return must(s, '  "zh-tw": ["研究', VI_CHOICES + '  "zh-tw": ["研究')
edit("server/initial-greeting.ts", vi_greeting)
edit("server/initial-greeting.test.ts", lambda s: s if "vi-VN" in s else must(s,
    '    expect(initialGreeting("Scout", "zh-TW", "王小明")).toBe("嗨 王小明，我是 Scout。你想要我幫你做什麼？");\n',
    '    expect(initialGreeting("Scout", "zh-TW", "王小明")).toBe("嗨 王小明，我是 Scout。你想要我幫你做什麼？");\n'
    '    expect(initialGreeting("Scout", "vi-VN", "Nguyễn Tuấn")).toBe("Xin chào Nguyễn, mình là Scout. Bạn muốn mình giúp việc gì?");\n'))
edit("server/index.ts", lambda s: must(s,
    "const appLanguage = (): string | undefined => cfg.language ?? CLOUD_TEAM?.language;",
    "const appLanguage = (): string | undefined => cfg.language ?? CLOUD_TEAM?.language ?? (process.env.OMB_UI_LANGUAGE?.trim() || undefined);"))
edit("electron/main.mjs", lambda s: s if "OMB_UI_LANGUAGE" in s else must(s, "    OMB_DATA_DIR: dataDir,\n",
    "    OMB_DATA_DIR: dataDir,\n"
    "    // The language picked in this app, so the first greeting and the starting choices are written in it (empty: follow the system).\n"
    "    OMB_UI_LANGUAGE: nativeText.prefs?.language() ?? \"\",\n"))

# 11b. Bot templates from github.com/leomieo/limix-bot-templates, the way the Skill Hub works: Templates > Khám phá
# lists bots from catalog.json (limix/overlay/server/limix-bot-library.ts) and fetches one bot's file only when
# "Dùng mẫu" is pressed (limix/overlay/src/components/LimixBotGallery.tsx); offline, the built-in bots show.
def bot_library_routes(s):
    if "handleLimixBotLibrary" in s:
        return s
    s = s.replace("\nimport ", '\nimport { handleLimixBotLibrary } from "../limix-bot-library.ts";\nimport ', 1)
    return must(s, '    if (path.startsWith("/api/limix/hub")) {',
                   '    if (path.startsWith("/api/limix/bots")) {\n'
                   '      const library = await handleLimixBotLibrary(method, path);\n'
                   '      if (library) return json(res, library.status, library.body);\n    }\n'
                   '    if (path.startsWith("/api/limix/hub")) {')
edit("server/routes/bot-skills.ts", bot_library_routes)

def bot_library_gallery(s):
    if "refreshTemplates" in s and 'tab === "teams"' in s:
        return s
    s = must(s, 'import { ReadyBotGallery } from "./ReadyBotGallery";', 'import { LimixBotGallery } from "./LimixBotGallery";')
    s = must(s, "<ReadyBotGallery search={search} onDialog", "<LimixBotGallery search={search} onRefresh={() => void loadCatalog(true)} onDialog")
    # "Cập nhật" asks for the team list past GitHub's cache too.
    s = must(s, "  const loadCatalog = useCallback(async () => {", "  const loadCatalog = useCallback(async (fresh = false) => {")
    return must(s, 'setCatalog((await api("/api/team-library/catalog")) as TeamCatalog);',
                   'setCatalog((await api(`/api/team-library/catalog${fresh ? "?fresh=1" : ""}`)) as TeamCatalog);')
edit("src/components/TeamLibraryPanel.tsx", bot_library_gallery)
edit("server/routes/teams.ts", lambda s: must(s, "        return json(res, 200, await fetchTeamCatalog());",
    "        return json(res, 200, await fetchTeamCatalog(url.searchParams.get(\"fresh\") ? ((input, init) => fetch(`${String(input)}?t=${Date.now()}`, init)) as typeof fetch : fetch));"))

def bot_library_dialog(s):
    if "readyBotData" in s:
        return s
    s = must(s, 'import { readyBot, readyBotTemplate } from "@/lib/ready-bots";',
                'import { readyBot, readyBotTemplate, type ReadyBot } from "@/lib/ready-bots";')
    s = must(s, "  readyBotId?: string;\n}", "  readyBotId?: string;\n  /** The same, downloaded from the template library: used instead of the built-in copy. */\n  readyBotData?: ReadyBot;\n}")
    s = must(s, "function NewBotEditor({ defaultsMode = false, onClose, onCreated, readyBotId }: NewBotDialogProps) {",
                "function NewBotEditor({ defaultsMode = false, onClose, onCreated, readyBotId, readyBotData }: NewBotDialogProps) {")
    s = must(s, "        const ready = defaultsMode || !readyBotId ? undefined : readyBot(readyBotId);",
                "        const ready = defaultsMode ? undefined : readyBotData ?? (readyBotId ? readyBot(readyBotId) : undefined);")
    s = must(s, "        if (ready) next.role = ready.id;", "        if (ready && readyBot(ready.id)) next.role = ready.id;")
    return must(s, "  }, [defaultsMode, readyBotId]);", "  }, [defaultsMode, readyBotId, readyBotData]);")
edit("src/components/NewBotDialog.tsx", bot_library_dialog)

edit("src/locales/vi.json", lambda s: s.replace('"templates.load": "Nạp",', '"templates.load": "Dùng mẫu",').replace(
    '"readyBots.subtitle": "Thêm một bot rồi bắt đầu trò chuyện. Bạn được xem lại mọi thứ trước khi tạo.",',
    '"readyBots.subtitle": "Bấm Dùng mẫu để tải mẫu về; bạn được xem lại mọi thứ trước khi tạo bot.",'))

# 11c. Sign out of the Limix account from the app: "Đăng xuất" at the end of the account menu (bottom-left avatar;
# limix/overlay/src/lib/limix-account-menu.tsx). Main confirms, frees this computer's seat, forgets the token and restarts
# at the sign-in window, which also gained a full "Đăng ký" button (limix/overlay/electron/limix-account.mjs).
def sign_out_main(s):
    if "limix-account:sign-out" in s:
        return s
    s = must(s, 'import { limixAccountGate, limixRemoteCredential } from "./limix-account.mjs";',
                'import { limixAccountGate, limixAccountInfo, limixRemoteCredential, limixSignOut } from "./limix-account.mjs";')
    return must(s, 'app.on("will-quit", () => limixGateway?.stop());\n',
                'app.on("will-quit", () => limixGateway?.stop());\n'
                'ipcMain.handle("limix-account:info", localOnly("limix-account:info", () => limixAccountInfo()));\n'
                'ipcMain.handle("limix-account:sign-out", localOnly("limix-account:sign-out", async (event) => {\n'
                '  const info = limixAccountInfo();\n'
                '  if (!info) return false;\n'
                '  const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;\n'
                '  const { response } = await dialog.showMessageBox(owner, { type: "question", title: "Limix Bot", buttons: [lxm("Đăng xuất", "Sign out"), lxm("Hủy", "Cancel")], defaultId: 1, cancelId: 1,\n'
                '    message: lxm(`Đăng xuất khỏi tài khoản ${info.username || "Limix"}?`, `Sign out of the account ${info.username || "Limix"}?`),\n'
                '    detail: lxm("Máy này sẽ được gỡ khỏi tài khoản và ứng dụng khởi động lại ở màn hình đăng nhập. Bot, cuộc trò chuyện và dữ liệu trên máy vẫn được giữ nguyên.", "This computer will be removed from the account and the app restarts at the sign-in window. Bots, conversations and data on this computer are kept.") });\n'
                '  if (response !== 0) return false;\n'
                '  await limixSignOut();\n'
                '  app.relaunch(); app.quit();\n'
                '  return true;\n'
                '}));\n')
edit("electron/main.mjs", sign_out_main)
edit("electron/preload.cjs", lambda s: s if "limix-account:sign-out" in s else must(s,
    '  limixGateway: { open: () => ipcRenderer.invoke("limix-gateway:open") },\n',
    '  limixGateway: { open: () => ipcRenderer.invoke("limix-gateway:open") },\n'
    '  limixAccount: { info: () => ipcRenderer.invoke("limix-account:info"), signOut: () => ipcRenderer.invoke("limix-account:sign-out") },\n'))
edit("src/types/ogb.d.ts", lambda s: s if "limixAccount?:" in s else must(s, "      limixGateway?: { open(): Promise<void> };\n",
    "      limixGateway?: { open(): Promise<void> };\n"
    "      /** Limix Bot: the Limix account this computer is signed in to, and signing out (confirms, then restarts). */\n"
    "      limixAccount?: { info(): Promise<{ username: string; email: string } | null>; signOut(): Promise<boolean> };\n"))
def sign_out_menu(s):
    if "withLimixSignOut" in s:
        return s
    s = must(s, 'import { LimixPhoneDialog } from "./LimixPhoneDialog";\n',
                'import { LimixPhoneDialog } from "./LimixPhoneDialog";\nimport { useLimixAccount, withLimixSignOut } from "@/lib/limix-account-menu";\n')
    s = must(s, "  const items = profileMenuItems({\n", "  const limixAccount = useLimixAccount();\n  const items = withLimixSignOut(limixAccount, profileMenuItems({\n")
    return must(s, "    onAccount: openCloudAccount,\n  });\n  const noteworthy", "    onAccount: openCloudAccount,\n  }));\n  const noteworthy")
edit("src/components/SidebarProfileMenu.tsx", sign_out_menu)

# 11d. Skills per bot (owner's choice 2026-11-13). A new bot gets only Limix's core skills (learning skills, Agent
# Reach, Windows automation, the phone helpers) plus what it learns; everything else waits in the store and is added to
# one bot at a time from Bot → Kĩ Năng (Skills) → "Kho Kĩ Năng (Skills)" (limix/overlay/server/limix-skill-store.ts,
# limix/overlay/src/components/LimixSkillStore.tsx). Settings → Kĩ Năng (Skills) only downloads skills; its "every bot"
# switch is gone (shown only on a skill still set that way). Skills from this computer are opt-in per bot. /id calls a
# shipped skill too. Templates may list "skills" (limix/overlay/server/limix-bot-library.ts).
def skills_index(s):
    if "limixBundledFor" in s:
        return s
    s = must(s, 'import { startHubAutoSync } from "./limix-skill-hub.ts";\n',
                'import { startHubAutoSync } from "./limix-skill-hub.ts";\n'
                'import { limixBundledFor, limixSelectBundled, limixSkillDefaultsMigration } from "./limix-skill-store.ts";\n')
    s = must(s, "const bundledSkills = loadBundledSkills();\n", "const bundledSkills = loadBundledSkills();\nlimixSkillDefaultsMigration();\n")
    s = must(s, "const skills = availableSkills(), phoneOffered = usbPhoneOffered(instance, skills) && !proactive",
                "const skills = limixBundledFor(bot.id, availableSkills()), phoneOffered = usbPhoneOffered(instance, skills) && !proactive")
    s = must(s, "const skills = availableSkills(), phoneOffered = usbPhoneOffered(instance, skills);",
                "const skills = limixBundledFor(bot.id, availableSkills()), phoneOffered = usbPhoneOffered(instance, skills);")
    s = must(s, "const selectedSkills = selectBundledSkills(\n", "const selectedSkills = limixSelectBundled(\n")
    s = must(s, "    selectBundledSkills(\n      roomContext,", "    limixSelectBundled(\n      roomContext,")
    s = must(s, "    selectBundledSkills(\n      latestUser?.text", "    limixSelectBundled(\n      latestUser?.text")
    if s.count("selectBundledSkills") == 1:
        s = must(s, "  selectBundledSkills,\n", "")
    return s
edit("server/index.ts", skills_index)
def skills_routes(s):
    if "handleLimixSkillStore" in s:
        return s
    s = must(s, 'import { handleLimixHub } from "../limix-skill-hub.ts";\n',
                'import { handleLimixHub } from "../limix-skill-hub.ts";\n'
                'import { handleLimixSkillStore, LIMIX_CORE_SKILLS, limixBundledListings, limixBundledSwitch } from "../limix-skill-store.ts";\n')
    s = must(s, '    if (method === "GET" && path === "/api/limix/bundled-skills") {\n',
                '    if (path.startsWith("/api/limix/skill-store/")) {\n'
                '      const skillStore = handleLimixSkillStore(store, method, path, method === "POST" ? await readBody(req) : undefined);\n'
                '      if (skillStore) return json(res, skillStore.status, skillStore.body);\n'
                '    }\n'
                '    if (method === "GET" && path === "/api/limix/bundled-skills") {\n')
    s = must(s, "triggerTerms: manifest.triggerTerms }));", "triggerTerms: manifest.triggerTerms, core: LIMIX_CORE_SKILLS.has(manifest.id) }));")
    s = must(s, "          skills: [...skills, ...listBotSkills(bot, threadId).filter((skill) => !names.has(skill.name))],\n",
                "          skills: [...skills, ...listBotSkills(bot, threadId).filter((skill) => !names.has(skill.name)),\n"
                "            ...limixBundledListings(bot.id).filter((skill) => !names.has(skill.name) && !listBotSkills(bot, threadId).some((other) => other.name === skill.name))],\n")
    s = must(s, "        skills: listBotSkills(bot, threadId),\n", "        skills: [...listBotSkills(bot, threadId), ...limixBundledListings(bot.id)],\n")
    s = must(s, "      const result = setSkillEnabled(m[1]!, m[2]!, parsed.data.enabled);\n      if (\"error\" in result) return json(res, 404, { error: result.error });\n",
                "      const result = setSkillEnabled(m[1]!, m[2]!, parsed.data.enabled);\n"
                "      if (\"error\" in result) {\n"
                "        const shipped = limixBundledSwitch(m[1]!, m[2]!, parsed.data.enabled);\n"
                "        if (shipped) return json(res, shipped.status, shipped.body);\n"
                "        return json(res, 404, { error: result.error });\n"
                "      }\n")
    return s
edit("server/routes/bot-skills.ts", skills_routes)
def skills_imported(s):
    if "picked: z.array" in s:
        return s
    s = must(s, "  listed: z.array(z.string()).optional(),\n});", "  listed: z.array(z.string()).optional(),\n  /** Limix Bot: skills from this computer are off for a bot until a person adds one from its store. */\n  picked: z.array(z.string()).optional(),\n});")
    s = must(s, "  if (choices.off.includes(name)) return false;\n", "  if (choices.off.includes(name)) return false;\n  if (!(choices.picked ?? []).includes(name)) return false;\n")
    s = must(s, "  const listed = choices.listed?.filter((other) => other !== name);\n  const next: Choices = enabled\n    ? { off, on: entry.warnings.length ? { ...on, [name]: entry.filesSha256 } : on, ...(listed ? { listed: [...listed, name].sort() } : {}) }\n    : { off: [...off, name].sort(), on, ...(listed ? { listed } : {}) };",
                "  const listed = choices.listed?.filter((other) => other !== name);\n  const picked = (choices.picked ?? []).filter((other) => other !== name);\n  const next: Choices = enabled\n    ? { off, on: entry.warnings.length ? { ...on, [name]: entry.filesSha256 } : on, ...(listed ? { listed: [...listed, name].sort() } : {}), picked: [...picked, name].sort() }\n    : { off: [...off, name].sort(), on, ...(listed ? { listed } : {}), picked };")
    return s
edit("server/imported-skills.ts", skills_imported)
def skills_panel(s):
    if "LimixSkillStoreDialog" in s:
        return s
    s = must(s, 'import { useOpenComputer, WherePage } from "./ComputerTab";\n',
                'import { useOpenComputer, WherePage } from "./ComputerTab";\nimport { LimixSkillStoreDialog } from "../LimixSkillStore";\n')
    s = must(s, '  const browse = () => {\n    if (libraryOn) {\n      dispatch({ type: "toggleSettings", open: false });\n      dispatch({ type: "toggleAppSettings", open: true, section: "skills" });\n      return;\n    }\n    void openExternalLink(SKILLS_SITE);\n  };\n',
                '  const [storeOpen, setStoreOpen] = useState(false);\n'
                '  const openSkillSettings = () => {\n    setStoreOpen(false);\n    dispatch({ type: "toggleSettings", open: false });\n    dispatch({ type: "toggleAppSettings", open: true, section: "skills" });\n  };\n'
                '  const browse = () => {\n    if (libraryOn) {\n      setStoreOpen(true);\n      return;\n    }\n    void openExternalLink(SKILLS_SITE);\n  };\n')
    s = must(s, "            disabled={Boolean(skills.working)}\n            onChange={() => void skills.toggle(skill)}\n            extra={skill.origin === \"imported\" || skill.origin === \"native\" ? undefined",
                "            disabled={Boolean(skills.working) || (skill as { core?: boolean }).core === true}\n            onChange={() => void skills.toggle(skill)}\n            extra={skill.origin === \"imported\" || skill.origin === \"native\" || (skill.origin as string) === \"bundled\" ? undefined")
    s = must(s, "      {skills.reviewing && (\n        <SkillReviewDialog",
                "      {storeOpen && <LimixSkillStoreDialog botId={bot.id} botName={bot.name} onOpenSettings={openSkillSettings} onClose={() => { setStoreOpen(false); void skills.refresh(); }} />}\n"
                "      {skills.reviewing && (\n        <SkillReviewDialog")
    return s
edit("src/components/bot-panel/pages.tsx", skills_panel)
def skills_settings(s):
    if "{skill.everyBot && (" in s or "toggleEveryBot" not in s:
        return s
    s = must(s, '                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-inset px-2.5 py-2">\n                    <div>\n                      <div className="text-[12px] font-medium text-ink">{t("skills.library.everyBot")}</div>',
                '                  {skill.everyBot && (\n                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-inset px-2.5 py-2">\n                    <div>\n                      <div className="text-[12px] font-medium text-ink">{t("skills.library.everyBot")}</div>')
    return must(s, "                      onClick={() => void toggleEveryBot(skill)}\n                    />\n                  </div>\n",
                   "                      onClick={() => void toggleEveryBot(skill)}\n                    />\n                  </div>\n                  )}\n")
edit("src/components/SkillsSection.tsx", skills_settings)
SKILL_LABELS = {
    '"botSettings.simple.skills": "Kỹ năng"': '"botSettings.simple.skills": "Kĩ Năng (Skills)"',
    '"settings.section.skills": "Kỹ năng"': '"settings.section.skills": "Kĩ Năng (Skills)"',
    '"botSettings.sections.skills": "Kỹ năng"': '"botSettings.sections.skills": "Kĩ Năng (Skills)"',
    '"botPanel.skills.bundled": "Kỹ năng có sẵn của Limix Bot"': '"botPanel.skills.bundled": "Kho Kĩ Năng (Skills)"',
    '"skills.library.allAssigned": "Mọi kỹ năng trong thư viện đều đã được gán cho bot này."': '"skills.library.allAssigned": "Bot này đã có mọi kĩ năng trong kho."',
    '"skills.library.manageHint": "Nhập và quản lý kỹ năng thư viện trong Cài đặt → Kỹ năng."': '"skills.library.manageHint": "Tải kĩ năng mới trong Cài đặt → Kĩ Năng (Skills), rồi thêm cho từng bot ở mục Kĩ Năng (Skills) của bot."',
    '"botSettings.simple.skillsHint": "Những việc {name} đã học được. Hãy tắt một kỹ năng nếu không muốn {name} tiếp tục dùng."':
        '"botSettings.simple.skillsHint": "Kĩ năng {name} đang dùng: kĩ năng gốc của Limix Bot, kĩ năng {name} tự học và kĩ năng bạn thêm từ Kho. Tắt một kĩ năng để bỏ khỏi {name}. Gõ /tên-kĩ-năng trong chat để gọi."',
}
def skills_vi(s):
    for old, new in SKILL_LABELS.items():
        if new not in s:
            s = must(s, old, new)
    return s
edit("src/locales/vi.json", skills_vi)

# 11e. Limix Bot's own windows and dialogs (main process) follow the app's language: Vietnamese, else English.
def limix_language(s):
    if "limix-lang.mjs" not in s:
        s = must(s, 'import { limixRuntimeEnv } from "./limix-runtime.mjs";\n',
                 'import { limixRuntimeEnv } from "./limix-runtime.mjs";\nimport { lxm, setLimixLanguageSource } from "./limix-lang.mjs";\n')
    if "setLimixLanguageSource(" not in s.split("limix-lang.mjs", 1)[1]:
        s = must(s, "const nativeText = createDesktopText(app), nativeT = nativeText.t;",
                 "const nativeText = createDesktopText(app), nativeT = nativeText.t; setLimixLanguageSource(() => nativeText.prefs?.language() || app.getLocale());")
    return s
edit("electron/main.mjs", limix_language)
# 11f. Notice names shown by clients that print tool names: Vietnamese app, Vietnamese words; otherwise upstream English.
def rescue_language(s):
    if "limixVi()" in s:
        return s
    helper = 'const limixVi = (): boolean => /^vi/i.test((typeof process !== "undefined" ? process.env?.OMB_UI_LANGUAGE : "") ?? "");\n\n'
    for vi, en in [
        ("`notice: ${botName} vẫn chưa nhận được phản hồi từ ${ai}.`", "`notice: ${botName} hasn't heard back from ${ai} yet.`"),
        ("`notice: ${botName} không nhận được phản hồi từ ${ai}.`", "`notice: ${botName} didn't hear back from ${ai}.`"),
        ("`notice: ${ai} đã trả lời, sau một lúc chậm.`", "`notice: ${ai} answered after a slow start.`"),
    ]:
        both = f"limixVi() ? {vi} : {en}"
        s = s.replace(f"return {vi};", f"return {both};").replace(f"return {en};", f"return {both};")
    return s.replace("/** The waiting row's words", helper + "/** The waiting row's words", 1)
edit("shared/first-reply-rescue.ts", rescue_language)
# 11g. English names for the renamed skills labels (Vietnamese ones are set in 11d).
def skills_en(s):
    for old, new in {
        '"botPanel.skills.bundled": "Limix Bot\'s built-in skills"': '"botPanel.skills.bundled": "Skills Store"',
        '"skills.library.allAssigned": "Every skill in the library is already assigned to this bot."': '"skills.library.allAssigned": "This bot already has every skill in the store."',
        '"skills.library.manageHint": "Import and manage library skills in Settings → Skills."': '"skills.library.manageHint": "Download more skills in Settings → Skills."',
        '"botSettings.simple.skillsHint": "Things {name} has learned to do. Switch one off and {name} stops using it."': '"botSettings.simple.skillsHint": "Skills {name} uses: Limix Bot core skills, skills {name} learned itself and skills you added from the store. Switch one off to stop it."',
    }.items():
        if new not in s:
            s = must(s, old, new)
    return s
edit("src/locales/en.json", skills_en)

# 11h. Limix Bot on a server, 24/7: the Docker image runs the Telegram / Zalo / Discord connector as the server's
# sidecar (limix/overlay/server/limix-gateway-sidecar.ts), its page is proxied at /api/limix/gateway/ behind the
# server's sign-in, and the one-command installer (deploy/install.sh) installs Limix Bot's own image and releases.
def sidecar_index(s):
    if "limix-gateway-sidecar.ts" in s:
        return s
    s = must(s, 'import { startHubAutoSync } from "./limix-skill-hub.ts";\n',
             'import { startHubAutoSync } from "./limix-skill-hub.ts";\nimport { startLimixGatewaySidecar } from "./limix-gateway-sidecar.ts";\n')
    return must(s, "\nlimixSkillDefaultsMigration();\n", "\nlimixSkillDefaultsMigration();\nstartLimixGatewaySidecar({ port: PORT, webhookPort: WEBHOOK_PORT });\n")
edit("server/index.ts", sidecar_index)
def sidecar_route(s):
    if "proxyLimixGateway" in s:
        return s
    s = must(s, 'import { handleLimixSkillStore, ', 'import { proxyLimixGateway } from "../limix-gateway-sidecar.ts";\nimport { handleLimixSkillStore, ')
    return must(s, '    let m: RegExpMatchArray | null = null;\n    if (path.startsWith("/api/limix/bots")) {',
                '    let m: RegExpMatchArray | null = null;\n    if (path.startsWith("/api/limix/gateway") && proxyLimixGateway(req, res, path)) return;\n    if (path.startsWith("/api/limix/bots")) {')
edit("server/routes/bot-skills.ts", sidecar_route)
def sidecar_image(s):
    if "limix-gateway" in s:
        return s
    s = must(s, "COPY --from=build --chown=maus:maus /src/skills ./skills\n# `docker compose exec omb openmausbot pair`",
             "COPY --from=build --chown=maus:maus /src/skills ./skills\n"
             "# Limix Bot: the Telegram / Zalo / Discord connector, run by the server as its sidecar (no npm packages).\n"
             "COPY --from=build --chown=maus:maus /src/limix/gateway/src ./limix-gateway/src\n"
             "COPY --from=build --chown=maus:maus /src/limix/gateway/package.json ./limix-gateway/package.json\n"
             "# `docker compose exec omb openmausbot pair`")
    return must(s, 'ENV HOME=/data \\\n    OMB_CLI_PREFIX="docker compose exec omb openmausbot"',
                'ENV HOME=/data \\\n    LIMIX_GATEWAY_SIDECAR=1 \\\n    OMB_CLI_PREFIX="docker compose exec omb openmausbot"')
edit("Dockerfile", sidecar_image)
def limix_installer(s):
    for old, new in [
        ("IMAGE_REPO=milind-soni/openmausbot", "IMAGE_REPO=leomieo/limix-bot"),
        ("https://api.github.com/repos/milind-soni/OpenMausBot/releases/latest", "https://api.github.com/repos/leomieo/limix-bot/releases/latest"),
        ("https://raw.githubusercontent.com/milind-soni/OpenMausBot/main/deploy/install.sh", "https://raw.githubusercontent.com/leomieo/limix-bot/main/deploy/install.sh"),
        ("REPOSITORY_FILES=https://raw.githubusercontent.com/milind-soni/OpenMausBot\n", "REPOSITORY_FILES=https://raw.githubusercontent.com/leomieo/limix-bot\n"),
        ('INSTALL_DIR="${OMB_INSTALL_DIR:-/opt/openmausbot}"', 'INSTALL_DIR="${OMB_INSTALL_DIR:-/opt/limixbot}"'),
    ]:
        s = s.replace(old, new)
    # The name it prints (not paths such as /etc/mausbot, which the sandbox profiles use).
    return re.sub(r"(?<![A-Za-z/])MausBot(?![A-Za-z])", "Limix Bot", s)
edit("deploy/install.sh", limix_installer)

# 11i. A machine with no public address (home or office internet, no static IP): `--tunnel TOKEN` serves Limix Bot
# through a Cloudflare tunnel (cloudflared beside Caddy). No port is opened on the router or the machine; the domain's
# public hostname is set in Cloudflare (Zero Trust → Tunnels) to http://caddy:80. The token is kept in .env, so running
# the installer again (or updating) keeps the tunnel.
TUNNEL_FUNCS = """
# Limix Bot: the tunnel mode (--tunnel TOKEN, kept in .env as CF_TUNNEL_TOKEN). Caddy serves plain HTTP for the domain
# on the machine itself only; cloudflared carries the HTTPS traffic in from Cloudflare.
limix_tunnel_files() {
  if [ -z "$TUNNEL_TOKEN" ]; then unset_env CF_TUNNEL_TOKEN; return; fi
  set_env CF_TUNNEL_TOKEN "$TUNNEL_TOKEN"
  sed -e 's/^      - "80:80"$/      - "127.0.0.1:8080:80"/' -e '/^      - "443:443"$/d' "$INSTALL_DIR/compose.yaml" | write_file "$INSTALL_DIR/compose.yaml"
  if grep -q "^  tunnel:$" "$INSTALL_DIR/compose.yaml"; then return; fi  # already in this file
  tunnel_block=$(mktemp)
  cat >"$tunnel_block" <<'TUNNEL'
  tunnel:
    image: cloudflare/cloudflared:2026.9.3
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${CF_TUNNEL_TOKEN:?run the installer again}
    depends_on:
      caddy:
        condition: service_started

TUNNEL
  awk 'NR == FNR { block = block $0 "\\n"; next } /^volumes:$/ && !done { printf "%s", block; done = 1 } { print }' "$tunnel_block" "$INSTALL_DIR/compose.yaml" | write_file "$INSTALL_DIR/compose.yaml"
  rm -f "$tunnel_block"
  sed -e 's/^{\\$DOMAIN} {$/http:\\/\\/{$DOMAIN} {/' -e 's/^\\(\\t*\\)flush_interval -1$/\\1flush_interval -1\\n\\1header_up X-Forwarded-Proto https/' "$INSTALL_DIR/Caddyfile" | write_file "$INSTALL_DIR/Caddyfile"
}

limix_tunnel_public() {
  waited=0
  while [ "$waited" -lt 60 ]; do
    if curl -fsS --max-time 10 "https://$DOMAIN/api/health" 2>/dev/null | grep -q openmausbot; then ok "https://$DOMAIN answers through the Cloudflare tunnel"; return 0; fi
    sleep 5
    waited=$((waited + 5))
  done
  note "Limix Bot runs here, but https://$DOMAIN does not answer through the tunnel yet. In Cloudflare (Zero Trust → Networks → Tunnels → this tunnel → Public hostname) add $DOMAIN with the service http://caddy:80. It works as soon as that is saved; nothing here needs to run again."
}
"""
def installer_tunnel(s):
    if "limix_tunnel_files" in s:
        return s
    s = must(s, '  HEALTH_WAIT_S="${OMB_INSTALL_HEALTH_WAIT_S:-240}"\n',
             '  HEALTH_WAIT_S="${OMB_INSTALL_HEALTH_WAIT_S:-240}"\n  TUNNEL_TOKEN="${LIMIX_TUNNEL_TOKEN:-}"\n')
    s = must(s, '      --domain | --email | --dir)\n', '      --domain | --email | --dir | --tunnel)\n')
    s = must(s, '          --dir) INSTALL_DIR=$2 ;;\n', '          --dir) INSTALL_DIR=$2 ;;\n          --tunnel) TUNNEL_TOKEN=$2 ;;\n')
    s = must(s, '      --dir=*) INSTALL_DIR=${1#--dir=} ;;\n', '      --dir=*) INSTALL_DIR=${1#--dir=} ;;\n      --tunnel=*) TUNNEL_TOKEN=${1#--tunnel=} ;;\n')
    s = must(s, '  case "$CODE" in\n', '  case "$TUNNEL_TOKEN" in\n    "") ;;\n    *[!A-Za-z0-9+/=_-]*) fail "That tunnel token does not look right. Copy it again from Cloudflare (the long text after --token)." ;;\n  esac\n  case "$CODE" in\n')
    s = must(s, '  say "  --no-sandbox ', '  say "  --tunnel TOKEN     a machine with no public address (home internet): serve it through this Cloudflare tunnel"\n  say "  --no-sandbox ')
    s = must(s, 'check_ports() {\n', 'check_ports() {\n  if [ -n "$TUNNEL_TOKEN" ]; then ok "ports 80 and 443: not needed (Cloudflare tunnel)"; return; fi\n')
    s = must(s, 'check_dns() {\n', 'check_dns() {\n  if [ -n "$TUNNEL_TOKEN" ]; then note "DNS: $DOMAIN reaches this machine through the Cloudflare tunnel (its public hostname in Cloudflare)."; return; fi\n')
    s = must(s, 'https_answers() {\n', 'https_answers() {\n  if [ -n "$TUNNEL_TOKEN" ]; then curl -fsS --max-time 10 -H "Host: $DOMAIN" "http://127.0.0.1:8080/api/health" 2>/dev/null | grep -q openmausbot; return; fi\n')
    s = must(s, '  write_caddyfile\n  write_settings\n', '  write_caddyfile\n  write_settings\n  limix_tunnel_files\n')
    s = must(s, 'then run this again. Caddy\'s reason: cd $INSTALL_DIR && sudo docker compose logs caddy --tail 30"\n}\n',
             'then run this again. Caddy\'s reason: cd $INSTALL_DIR && sudo docker compose logs caddy --tail 30"\n  if [ -n "$TUNNEL_TOKEN" ]; then limix_tunnel_public; fi\n}\n' + TUNNEL_FUNCS)
    old = '  if [ -z "$DOMAIN" ]; then DOMAIN=$(env_value DOMAIN); fi\n'
    assert s.count(old) == 2, s.count(old)
    return s.replace(old, old + '  if [ -z "$TUNNEL_TOKEN" ]; then TUNNEL_TOKEN=$(env_value CF_TUNNEL_TOKEN); fi\n')
edit("deploy/install.sh", installer_tunnel)
# 11j. Skills in the app's language: shipped skills show their description in Vietnamese or English (limixSkillText),
# skills a bot writes itself are written in the app's language (Vietnamese app → Vietnamese text, name stays ASCII),
# and the phone skills no longer say MausBot.
def skills_text_route(s):
    if "limixSkillText" in s:
        return s
    s = must(s, 'import { handleLimixSkillStore, LIMIX_CORE_SKILLS, ', 'import { handleLimixSkillStore, LIMIX_CORE_SKILLS, limixSkillText, ')
    return must(s, "name: manifest.name, description: manifest.description, defaultEnabled:", "name: manifest.name, description: limixSkillText(manifest.id, manifest.description), defaultEnabled:")
edit("server/routes/bot-skills.ts", skills_text_route)
def skills_learn_language(s):
    if "limix-lang.ts" in s:
        return s
    s = must(s, 'import { SAVE_RUN_AS_SKILL_LINE } from "../shared/learn-request.ts";\n',
             'import { SAVE_RUN_AS_SKILL_LINE } from "../shared/learn-request.ts";\nimport { lxs } from "./limix-lang.ts";\n')
    return must(s, "- Frame work through tools this bot actually has: file tools, terminal, browser, phone, or skill_manage. Do not name shell utilities the file tools already wrap.`;",
                "- Frame work through tools this bot actually has: file tools, terminal, browser, phone, or skill_manage. Do not name shell utilities the file tools already wrap.${lxs(\"\\n\\nLanguage: write the frontmatter description in Vietnamese, the language of this app (people read it in the skill list, and they ask in Vietnamese). Write the body of SKILL.md in English, which every model follows most precisely. Keep `name` lowercase-hyphenated ASCII.\", \"\")}`;")
edit("server/skill-learn.ts", skills_learn_language)
def phone_skill_names(s):
    return s.replace("OpenMausBot", "Limix Bot").replace("MausBot Relay", "Limix Bot Relay").replace("MausBot", "Limix Bot")
for f in ["skills/phone-connection/SKILL.md", "skills/phone-connection/manifest.json", "skills/phone-harness/SKILL.md", "skills/phone-harness/agents/openai.yaml"]:
    edit(f, phone_skill_names)

# 11k. Hybrid skills (English core + Vietnamese layer): every shipped skill keeps its English SKILL.md, and gets
# Vietnamese trigger terms so a request in Vietnamese (with or without accents, limixSelectBundled) finds it. Only the
# chosen skills' SKILL.md is loaded into a turn; references/ are read only when the task needs them.
VI_TRIGGERS = {
    "agent-reach": ["tìm trên reddit", "tìm trên twitter", "đọc bài trên", "tóm tắt video youtube", "xem phụ đề"],
    "create-verification-skill": ["tạo kĩ năng kiểm chứng", "tạo kỹ năng kiểm chứng", "viết kĩ năng kiểm tra", "viết kỹ năng kiểm tra"],
    "data-dashboards": ["bảng điều khiển", "biểu đồ", "đồ thị", "trực quan hóa", "bảng số liệu", "trang web", "trang giới thiệu", "trang bảng giá", "bản mẫu giao diện"],
    "phone-connection": ["điện thoại không kết nối", "điện thoại không vào được", "kết nối điện thoại", "ghép điện thoại", "dùng 4g", "mạng di động", "cùng wi-fi", "anywhere, through limix bot", "limix bot app on my phone"],
    "phone-harness": ["điện thoại android", "gỡ lỗi usb", "điện thoại của tôi", "trên điện thoại", "ứng dụng di động"],
    "rea-video": ["video này", "cách làm video"],
    "social-posts": ["bài đăng", "viết bài đăng", "đăng facebook", "bài facebook", "bài tiktok", "viết caption", "chú thích instagram", "đăng lên mạng xã hội"],
    "ui-ux-pro-max": ["thiết kế giao diện", "trải nghiệm người dùng", "làm đẹp giao diện"],
    "windows-computer-automation": ["tự động hóa máy tính", "mở chương trình", "bấm nút trên máy"],
}
def vi_triggers(skill_id):
    def apply(s):
        data = json.loads(s)
        terms = data.get("triggerTerms", [])
        added = [t for t in VI_TRIGGERS[skill_id] if t not in terms]
        if not added:
            return s
        data["triggerTerms"] = terms + added
        return json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    return apply
for skill_id in VI_TRIGGERS:
    edit(f"skills/{skill_id}/manifest.json", vi_triggers(skill_id))

# 11l. "Connect … with ChatGPT" (ChatGPT plan sign-in): OpenAI shows the name the app registers its agent with.
edit("server/drivers/chatgpt-plan-auth.ts", lambda s: must(s, 'agent_name_hint: "openmausbot"', 'agent_name_hint: "Limix Bot"'))

# 11m. One remote address per Limix account: a computer that registers for remote access replaces the account's
# other computers (revoked in the same transaction); the cleanup cron then deletes their Cloudflare tunnel and DNS
# record, so the Cloudflare account never fills up. Migration 0017 (overlay) does the same once for existing accounts.
def cp_one_address(s):
    if "limix: one address" in s:
        return s
    s = must(s, "  const credential = await newCredential(now);\n  try {\n    await env.DB.batch([\n      // `kind` is written only when sent",
             "  const credential = await newCredential(now);\n"
             "  // limix: one address per account. The account's other computers are revoked first (their tunnels are deleted by the cron).\n"
             "  const replaced = session.user.id.startsWith(\"limix:\") ? [\n"
             "    env.DB.prepare(\"UPDATE installation_credentials SET revoked_at = ? WHERE revoked_at IS NULL AND installation_id IN (SELECT id FROM installations WHERE owner_user_id = ? AND revoked_at IS NULL)\").bind(now, session.user.id),\n"
             "    env.DB.prepare(\"DELETE FROM installation_push_devices WHERE installation_id IN (SELECT id FROM installations WHERE owner_user_id = ? AND revoked_at IS NULL)\").bind(session.user.id),\n"
             "    env.DB.prepare(\"UPDATE installations SET revoked_at = ?, updated_at = ? WHERE owner_user_id = ? AND revoked_at IS NULL\").bind(now, now, session.user.id),\n"
             "  ] : [];\n"
             "  try {\n    await env.DB.batch([\n      ...replaced,\n      // `kind` is written only when sent")
    return s
edit("cloudflare/control-plane/src/installations.ts", cp_one_address)

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

def remove_redundant_account_row(s):
    s = s.replace('accountMenuItems, AccountsSheet, cloudRowLabel, useAccounts', 'accountMenuItems, AccountsSheet, useAccounts')
    s = s.replace('  const cloudAccount = !remote && Boolean(window.ogb?.cloudAccount || (window.ogb?.cloudPlan && state.config?.cloudHome === true));\n', '')
    return s.replace('account: cloudAccount ? cloudRowLabel(accounts.view) : null,', 'account: null,')
edit("src/components/SidebarProfileMenu.tsx", remove_redundant_account_row)


def limix_container_names(s):
    s = s.replace('export const CONTAINER = "openmausbot-computer";', 'export const CONTAINER = "limixbot-computer";')
    if "export async function migrateLocalVmName(" not in s:
        s = must(s, "function normalizeImageId(", '\nexport async function migrateLocalVmName(runtime: Runtime, target: LocalVmTarget, runner: CommandRunner): Promise<void> {\n  if (runtime === "container" || !target.containerName.startsWith(CONTAINER)) return;\n  try {\n    await runner(runtime, ["inspect", target.containerName]);\n    return;\n  } catch {}\n  const legacy = target.containerName.replace(/^limixbot-computer/, "openmausbot-computer");\n  let labels: Record<string, string> | undefined;\n  try {\n    const { stdout } = await runner(runtime, ["inspect", legacy]);\n    labels = (JSON.parse(stdout) as Array<{ Config?: { Labels?: Record<string, string> } }>)[0]?.Config?.Labels;\n  } catch {\n    return;\n  }\n  if (!containerOwnershipLabelsMatch(labels, target)) return;\n  try {\n    await runner(runtime, ["rename", legacy, target.containerName]);\n  } catch (error) {\n    // Concurrent status requests may have already renamed the same container.\n    const { stdout } = await runner(runtime, ["inspect", target.containerName]);\n    const current = (JSON.parse(stdout) as Array<{ Config?: { Labels?: Record<string, string> } }>)[0];\n    if (!containerOwnershipLabelsMatch(current?.Config?.Labels, target)) throw error;\n  }\n}\n\n' + "function normalizeImageId(")
        s = must(s, '  try {\n    const { stdout } = await runner(status.runtime, ["inspect", target.containerName]);', '  await migrateLocalVmName(status.runtime, target, runner);\n\n  try {\n    const { stdout } = await runner(status.runtime, ["inspect", target.containerName]);')
    return s
edit("server/container-computer.ts", limix_container_names)

def remaining_visible_brand(s):
    return s.replace("https://github.com/milind-soni/OpenMausBot/blob/main/docs/", "https://github.com/leomieo/limix-bot/blob/main/docs/").replace("https://maus.example.com", "https://limix.example.com")
for folder in ("src", "limix/overlay/src"):
    for p in sorted((ROOT / folder).rglob("*")):
        if p.is_file() and p.suffix in (".ts", ".tsx", ".json") and "node_modules" not in p.parts:
            edit(p.relative_to(ROOT).as_posix(), remaining_visible_brand)
def package_display_brand(s):
    return s.replace("name: OpenMausBot package install", "name: Limix Bot package install").replace("vendor: OpenMausBot", "vendor: Limix AI").replace("Name: OpenMausBot", "Name: Limix Bot").replace("OpenMausBot uses", "Limix Bot uses").replace("OpenMausBot transcribes", "Limix Bot transcribes").replace("OpenMausBot connects", "Limix Bot connects").replace("OpenMausBot looks", "Limix Bot looks")
edit("electron-builder.yml", package_display_brand)

def explicit_modal_close(s):
    handler = 'onMouseDown={(event) => event.stopPropagation()}'
    s = re.sub(r'onMouseDown=\{(?:\(\w+\)|\w+) => \w+\.target === \w+\.currentTarget && [^{}\n]+\}', handler, s)
    s = re.sub(r'onMouseDown=\{(?:\(\w+\)|\w+) => \{[^{}]*?\w+\.target === \w+\.currentTarget[^{}]*?\}\}', handler, s)
    return s
for folder in ("src/components", "limix/overlay/src/components"):
    for p in sorted((ROOT / folder).rglob("*.tsx")):
        if ".test." not in p.name:
            edit(p.relative_to(ROOT).as_posix(), explicit_modal_close)

edit("src/components/CloudAddDialog.tsx", lambda s: re.sub(r"/\*\* Mid sign-in[^\n]*\*/\nconst HELD:[^\n]*\n", "", s))

edit("src/components/BrowserPanel.tsx", lambda s: s.replace(' onClick={(e) => { if (e.target === e.currentTarget) setShowProfiles(false); }}', ""))

def skill_requirement_scan_route(s):
    if "scanSkillRequirements" in s:
        return s
    s = s.replace('import { readLocalSkills } from "../limix-skill-folder.ts";', 'import { readLocalSkills } from "../limix-skill-folder.ts";\nimport { scanSkillRequirements } from "../limix-skill-requirements.ts";')
    return must(s, '    let m: RegExpMatchArray | null = null;', '    let m: RegExpMatchArray | null = null;\n    if (method === "GET" && path === "/api/limix/skill-requirements") {\n      return json(res, 200, await scanSkillRequirements(store.bots, cfg.mcpServers));\n    }')
edit("server/routes/bot-skills.ts", skill_requirement_scan_route)

def skill_install_bridge(s):
    if 'ipcMain.handle("limix-tools:install-requirements"' in s:
        return s
    anchor = 'ipcMain.handle("limix-tools:scan", localOnly("limix-tools:scan", () => limixTools ? limixTools.scan() : { supported: false, items: [] }));'
    return must(s, anchor, anchor + '\nipcMain.handle("limix-tools:install-requirement", localOnly("limix-tools:install-requirement", (_event, id, project) => limixTools.installRequirement(id, project)));\nipcMain.handle("limix-tools:install-requirements", localOnly("limix-tools:install-requirements", (_event, ids, project) => limixTools.installRequirements(ids, project)));')
edit("electron/main.mjs", skill_install_bridge)
edit("electron/preload.cjs", lambda s: s if "installRequirements:" in s else s.replace('limixTools: { state:', 'limixTools: { installRequirement: (id, project) => ipcRenderer.invoke("limix-tools:install-requirement", id, project), installRequirements: (ids, project) => ipcRenderer.invoke("limix-tools:install-requirements", ids, project), state:'))
def skill_install_scan_projects(s):
    if 'path === "/api/limix/skill-requirements/scan"' in s:
        return s
    s = s.replace('import { z } from "zod";', 'import { z } from "zod";\nimport { isAbsolute } from "node:path";')
    return must(s, '    let m: RegExpMatchArray | null = null;', '    let m: RegExpMatchArray | null = null;\n    if (method === "POST" && path === "/api/limix/skill-requirements/scan") {\n      const input = z.object({ projects: z.array(z.string().max(4096).refine(isAbsolute)).max(200) }).safeParse(await readBody(req));\n      if (!input.success) return json(res, 400, { error: "Choose valid project folders" });\n      return json(res, 200, await scanSkillRequirements(store.bots, cfg.mcpServers, input.data.projects));\n    }')
edit("server/routes/bot-skills.ts", skill_install_scan_projects)

for rel, edits in json.loads((ROOT / "limix/patches/vm-capacity.json").read_text(encoding="utf-8")).items():
    def apply_capacity_patch(s, edits=edits):
        for patch in edits:
            s = must(s, patch["before"], patch["after"])
        return s
    edit(rel, apply_capacity_patch)

for rel, edits in json.loads((ROOT / "limix/patches/offline-desktop.json").read_text(encoding="utf-8")).items():
    def apply_offline_desktop_patch(s, edits=edits):
        for patch in edits:
            if patch["after"] not in s:
                s = must(s, patch["before"], patch["after"])
        return s
    edit(rel, apply_offline_desktop_patch)

for rel, edits in json.loads((ROOT / "limix/patches/upstream-0.1.155.json").read_text(encoding="utf-8")).items():
    def apply_upstream_patch(s, edits=edits):
        for patch in edits:
            if patch["after"] not in s:
                s = must(s, patch["before"], patch["after"])
        return s
    edit(rel, apply_upstream_patch)
