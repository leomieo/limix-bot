import { readdirSync, readFileSync, statSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, relative, isAbsolute, delimiter } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseDocument } from "yaml";
import { DATA_DIR } from "./config.ts";
import { loadBundledSkills, loadUserSkills, listLibrarySkills, librarySkillDirectory, skillsLibraryRoot } from "./skill-library.ts";
import { readImportedSkills, IMPORTED_SKILLS_DIR } from "./imported-skills.ts";
import { listMigratableSkills } from "./skills.ts";
import { workspaceDir } from "./workspace.ts";
import type { BotRecord } from "./store.ts";

type Kind = "bin" | "npm" | "python" | "env" | "mcp" | "review";
export interface SkillRequirement { kind: Kind; name: string; required?: string; evidence: string; optional?: boolean; installScope?: "tool" | "project" }
interface Source { name: string; directory: string; projects: string[] }
export interface SkillRequirementResult extends SkillRequirement {
  skill: string;
  directory: string;
  status: "found" | "missing" | "review";
  version?: string;
  where?: string;
}
const run = promisify(execFile);
const PACKAGE = /^(?:@[a-z0-9_.-]+\/)?[a-z0-9][a-z0-9_.-]*$/i;
const BIN = /^[a-z0-9][a-z0-9_.-]{0,79}$/i;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function extractSkillRequirements(text: string): SkillRequirement[] {
  const out: SkillRequirement[] = [];
  const add = (kind: Kind, value: unknown, evidence: string) => {
    if (typeof value !== "string" || !value.trim()) return;
    const raw = kind === "review" ? value.trim() : value.trim().replace(/[.,;:]+$/, "");
    const match = raw.match(/^((?:@[\w.-]+\/)?[\w.-]+)(?:@|\s*(?=[<>=~^]))(.*)$/);
    const name = match?.[1] ?? raw;
    if (kind !== "review" && !(kind === "env" ? /^[A-Z_][A-Z0-9_]*$/.test(name) : kind === "bin" ? BIN.test(name) : PACKAGE.test(name))) {
      out.push({ kind: "review", name: raw, evidence });
      return;
    }
    out.push({ kind, name, ...(kind === "npm" && !["remotion", "@remotion/cli"].includes(name) && /\bnpm\s+(?:install|i)\b[^\n]*\s(?:-g|--global)(?:\s|$)/.test(evidence.split(/\s#|[;&|]/)[0]!) ? { installScope: "tool" as const } : {}), ...(match?.[2] ? { required: match[2] } : {}), evidence });
  };
  const read = (value: unknown, kind: Kind, evidence: string) => {
    if (Array.isArray(value)) for (const item of value) add(typeof item === "string" ? kind : "review", typeof item === "string" ? item : JSON.stringify(item), evidence);
    else if (typeof value === "string") add(kind, value, evidence);
    else for (const [name, version] of Object.entries(object(value))) add(kind, typeof version === "string" && version !== "*" ? `${name}@${version}` : name, evidence);
  };
  const front = text.replace(/^\uFEFF/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const body = front ? text.replace(/^\uFEFF/, "").slice(front[0].length) : text;
  if (front) {
    try {
      const doc = parseDocument(front[1]);
      if (doc.errors.length) throw new Error("invalid YAML");
      const fields = object(doc.toJS({ maxAliasCount: 20 }));
      const metadata = object(fields.metadata);
      for (const block of [fields.requires, fields.requirements, fields.dependencies, metadata.requires, metadata.requirements, metadata.dependencies, object(metadata.openclaw).requires, object(metadata.clawdbot).requires]) {
        const req = object(block);
        if (typeof block === "string" || Array.isArray(block)) read(block, "review", "SKILL.md metadata");
        for (const [key, kind] of Object.entries({ bins: "bin", tools: "bin", npm: "npm", packages: "npm", python: "python", pip: "python", env: "env", mcp: "mcp" }) as Array<[string, Kind]>) read(req[key], kind, `metadata.${key}`);
        for (const key of Object.keys(req)) if (!["bins", "tools", "npm", "packages", "python", "pip", "env", "mcp"].includes(key)) add("review", `${key}: ${JSON.stringify(req[key])}`, "SKILL.md metadata");
      }
      if (fields.compatibility) add("review", fields.compatibility, "compatibility");
    } catch {
      add("review", "SKILL.md metadata", "Could not parse the requirements metadata");
    }
  }
  const requirementLines = [front?.[1] ?? "", ...body.split(/\r?\n/).filter((line) => /requires?|prerequisit|dependenc|compatibility|yêu cầu|cần cài/i.test(line))].join("\n");
  for (const [pattern, name] of [[/\bffmpeg\b/i, "ffmpeg"], [/\bnode(?:\.js)?\b/i, "node"], [/\bdocker\b/i, "docker"], [/\bjava\b/i, "java"]] as const) {
    if (pattern.test(requirementLines) && !out.some((r) => r.kind === "bin" && r.name === name)) add("bin", name, "Mentioned in requirements / compatibility; check version in source");
  }
  const commands = [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g), ...body.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]!).join("\n") + "\n" + body.split(/\r?\n/).filter((line) => /^\s*(?:\$\s*)?(?:npm|pnpm|yarn|bun|pip3?|uv|npx|bunx)\s/.test(line)).join("\n");
  for (const match of commands.matchAll(/\b(npm\s+(?:install|i)|pnpm\s+add|yarn\s+add|bun\s+add|pip3?\s+install|uv\s+(?:pip\s+install|add|tool\s+install))\s+([^\n`]+)/gi)) {
    const kind = /pip|^uv/i.test(match[1]!) ? "python" : "npm";
    for (const raw of match[2]!.match(/"[^"]*"|'[^']*'|\S+/g) ?? []) {
      const token = raw.replace(/^["']|["']$/g, "");
      if (/^[;&|#\\]/.test(token)) break;
      if (token.startsWith("-")) {
        if (["--save", "--save-dev", "--save-exact", "--no-audit", "--no-fund", "-D", "-g", "--global", "--user", "--upgrade", "-U"].includes(token)) continue;
        add("review", match[0], "Install command needs review");
        break;
      }
      if (!/^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(?:(?:@|>=|<=|==|~=|>|<|=)[\w.^~*+<>=|,-]+)?$/i.test(token)) {
        add("review", match[0], "Install command needs review");
        break;
      }
      add(kind, token, match[0]!);
    }
  }
  for (const match of commands.matchAll(/\b(?:npx|bunx|pnpm\s+(?:exec|dlx))\s+(?:--?[\w-]+(?:=[^\s]+)?\s+)*((?:@[\w.-]+\/)?[\w.-]+(?:@[\w.^~+-]+)?)/g)) {
    add("npm", match[1] === "remotion" ? "@remotion/cli" : match[1], match[0]);
  }
  if (/\bremotion\b/i.test(text)) {
    for (const name of ["remotion", "@remotion/cli"]) if (!out.some((r) => r.kind === "npm" && r.name === name)) out.push({ kind: "npm", name, evidence: "Remotion code-rendering workflow", optional: true });
  }
  let section = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) section = /prerequisit|requirement|dependenc|installation|setup|yêu cầu|cài đặt|phụ thuộc/i.test(line);
    else if (section && line.trim() && !line.trim().startsWith("```")) add("review", line.trim(), "Requirements / setup instructions");
    else if (/\b(?:requires?|prerequisites?|dependencies|needs? to be installed)\b|yêu cầu|cần (?:cài|có)/i.test(line)) add("review", line.trim(), "Requirements mentioned in skill instructions");
  }
  const unique = new Map(out.map((req) => [`${req.kind}:${req.name}:${req.required ?? ""}`, req]));
  return [...unique.values()];
}

export function findSkillBinary(name: string, dirs: string[], platform = process.platform): string | null {
  if (!BIN.test(name)) return null;
  for (const dir of dirs) for (const ext of platform === "win32" ? ["", ".exe", ".cmd", ".bat", ".com"] : [""]) {
    const file = join(dir, name + ext);
    try { if (statSync(file).isFile()) return file; } catch {}
  }
  return null;
}

export function findSkillNpmPackage(name: string, roots: string[]): { version?: string; where: string } | null {
  if (!PACKAGE.test(name)) return null;
  for (const root of roots) {
    let dir = resolve(root);
    for (;;) {
      const file = join(dir, "node_modules", name, "package.json");
      try {
        const pkg = JSON.parse(readFileSync(file, "utf8"));
        if (pkg.name === name) return { version: typeof pkg.version === "string" ? pkg.version : undefined, where: file };
      } catch {}
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

export function findSkillPythonPackage(name: string, roots: string[]): { version: string; where: string } | null {
  const normalized = (value: string) => value.toLowerCase().replace(/[-_.]+/g, "-");
  for (const root of roots) for (const env of [root, join(root, ".venv"), join(root, "venv")]) {
    const sites = [join(env, "Lib", "site-packages")];
    try { for (const dir of readdirSync(join(env, "lib"))) if (/^python\d/.test(dir)) sites.push(join(env, "lib", dir, "site-packages")); } catch {}
    for (const site of sites) {
      try {
        for (const dir of readdirSync(site).filter((s) => s.endsWith(".dist-info"))) {
          const file = join(site, dir, "METADATA");
          const text = readFileSync(file, "utf8");
          if (normalized(text.match(/^Name: (.+)$/m)?.[1]?.trim() ?? "") !== normalized(name)) continue;
          const version = text.match(/^Version: (.+)$/m)?.[1]?.trim();
          if (version) return { version, where: file };
        }
      } catch {}
    }
  }
  return null;
}

export async function scanSkillRequirements(bots: readonly Pick<BotRecord, "id" | "name" | "cwd" | "computer">[], mcpServers: Record<string, unknown> = {}, projects: string[] = []) {
  const sources = new Map<string, Source>();
  const warnings: string[] = [];
  const add = (name: string, directory: string, projects: string[] = []) => {
    try {
      const real = realpathSync(directory);
      const prior = sources.get(real);
      if (prior) prior.projects = [...new Set([...prior.projects, ...projects])];
      else sources.set(real, { name, directory: real, projects });
    } catch { warnings.push(`Could not read ${name}`); }
  };
  for (const skill of [...loadBundledSkills(), ...loadUserSkills(join(DATA_DIR, "skills"))]) add(skill.manifest.name, skill.directory);
  for (const skill of listLibrarySkills()) add(skill.name, librarySkillDirectory(skillsLibraryRoot(), skill.name));
  for (const name of Object.keys(readImportedSkills())) add(name, join(IMPORTED_SKILLS_DIR, name));
  for (const bot of bots) for (const skill of listMigratableSkills(bot.id)) {
    if (skill.directory) add(`${skill.name} (${bot.name})`, skill.directory, [bot.cwd ?? workspaceDir(bot.id)]);
  }
  const home = homedir();
  const dirs = `${process.env.OMB_EXTRA_PATH ?? ""}${delimiter}${process.env.PATH ?? ""}`.split(delimiter).filter(Boolean);
  if (process.platform === "win32") {
    try {
      const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')"], { windowsHide: true, timeout: 8000 });
      dirs.push(...stdout.trim().split(";").map((p) => p.replace(/%([^%]+)%/g, (_m, key) => process.env[key] ?? "")));
    } catch { warnings.push("Could not refresh Windows PATH"); }
  }
  const requirements: SkillRequirementResult[] = [];
  for (const source of sources.values()) {
    const documents: Array<{ file: string; text: string }> = [];
    const readDocuments = (dir: string, depth = 0) => {
      if (depth > 4) { warnings.push(`Document depth limit: ${source.name}`); return; }
      try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (["node_modules", ".git", ".venv", "venv"].includes(entry.name) || entry.isSymbolicLink()) continue;
          const file = join(dir, entry.name);
          if (entry.isDirectory()) { readDocuments(file, depth + 1); continue; }
          if (!entry.isFile() || !(/\.md$/i.test(entry.name) || ["manifest.json", "requirements.json", "requirements.yaml", "requirements.yml", "package.json", "requirements.txt", "pyproject.toml"].includes(entry.name))) continue;
          const rel = relative(source.directory, realpathSync(file));
          if (isAbsolute(rel) || rel.startsWith("..")) continue;
          if (statSync(file).size > 256 * 1024) { warnings.push(`Document too large: ${source.name}/${entry.name}`); continue; }
          documents.push({ file: entry.name, text: readFileSync(file, "utf8") });
        }
      } catch { warnings.push(`Could not read documents: ${source.name}`); }
    };
    readDocuments(source.directory);
    const found: SkillRequirement[] = [];
    for (const doc of documents) {
      found.push(...extractSkillRequirements(doc.text));
      if (["manifest.json", "requirements.json", "requirements.yaml", "requirements.yml"].includes(doc.file)) found.push(...extractSkillRequirements(`---\n${doc.text}\n---`));
      if (doc.file === "package.json") {
        try {
          const pkg = JSON.parse(doc.text);
          for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })) found.push({ kind: "npm", name, required: String(version), evidence: "package.json" });
        } catch { warnings.push(`Invalid package.json: ${source.name}`); }
      }
      if (doc.file === "requirements.txt") for (const line of doc.text.split(/\r?\n/).filter((s) => s.trim() && !s.startsWith("#"))) {
        const match = line.trim().match(/^([\w.-]+)(.*)$/);
        found.push(match ? { kind: "python", name: match[1]!, required: match[2] || undefined, evidence: "requirements.txt" } : { kind: "review", name: line, evidence: "requirements.txt" });
      }
      if (doc.file === "pyproject.toml") {
        const declarations = doc.text.match(/(?:dependencies|requires)\s*=\s*\[[\s\S]*?\]/g) ?? ["Python project dependencies need review"];
        for (const declaration of declarations) found.push({ kind: "review", name: "pyproject.toml", evidence: declaration });
      }
    }
    if (!found.length) found.push({ kind: "review", name: "SKILL.md", evidence: "No machine-checkable requirements declared; review skill instructions" });
    if (!documents.some((doc) => doc.file === "SKILL.md")) warnings.push(`SKILL.md unreadable: ${source.name}`);
    const unique = new Map(found.map((req) => [`${req.kind}:${req.name}:${req.required ?? ""}`, req]));
    for (const req of unique.values()) {
      const result: SkillRequirementResult = { ...req, skill: source.name, directory: source.directory, status: "review" };
      if (req.kind === "bin") {
        const where = findSkillBinary(req.name, dirs);
        result.status = where ? req.required ? "review" : "found" : "missing";
        if (where) result.where = where;
      } else if (req.kind === "npm") {
        const pkg = findSkillNpmPackage(req.name, [source.directory, ...source.projects, ...projects, ...bots.filter((b) => !b.computer || b.computer === "local").map((b) => b.cwd ?? workspaceDir(b.id)), join(process.env.APPDATA ?? home, "npm")]);
        result.status = pkg ? req.required && req.required !== "*" ? "review" : "found" : "missing";
        if (pkg) Object.assign(result, pkg);
        if (req.installScope === "tool" && BIN.test(req.name) && !findSkillBinary(req.name, dirs)) result.status = "missing";
      } else if (req.kind === "env") result.status = process.env[req.name] ? "found" : "missing";
      else if (req.kind === "python") {
        const pkg = findSkillPythonPackage(req.name, [source.directory, ...source.projects, ...projects, ...bots.filter((b) => !b.computer || b.computer === "local").map((b) => b.cwd ?? workspaceDir(b.id))]);
        if (pkg) { Object.assign(result, pkg); result.status = req.required ? "review" : "found"; }
      }
      else if (req.kind === "mcp") result.where = Object.hasOwn(mcpServers, req.name) ? "Configured; connection needs checking" : "No matching MCP configuration";
      requirements.push(result);
    }
  }
  const python = process.env.LIMIX_PYTHON ?? findSkillBinary("python", dirs) ?? findSkillBinary("python3", dirs);
  const pythonRows = requirements.filter((r) => r.kind === "python" && !r.version && PACKAGE.test(r.name));
  if (python && pythonRows.length) {
    try {
      const names = [...new Set(pythonRows.map((r) => r.name))];
      const code = "import importlib.metadata as m,json,sys\nout={}\nfor n in sys.argv[1:]:\n try: out[n]=m.version(n)\n except m.PackageNotFoundError: pass\nprint(json.dumps(out))";
      const { stdout } = await run(python, ["-c", code, ...names], { timeout: 10000, windowsHide: true, maxBuffer: 1024 * 1024 });
      const versions = JSON.parse(stdout);
      for (const row of pythonRows) { row.version = versions[row.name]; row.where = python; row.status = row.version ? row.required ? "review" : "found" : "missing"; }
    } catch { warnings.push("Could not inspect Python package metadata"); }
  }
  return { scope: "host" as const, scannedAt: new Date().toISOString(), skillCount: sources.size, requirements, warnings };
}
