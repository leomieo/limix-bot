import path from "node:path";
import fsp from "node:fs/promises";
import { createHash } from "node:crypto";

const NPM = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const PYTHON = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const NPM_VERSION = /^[0-9xX*^~<>=| .+-]+$/;
const PYTHON_VERSION = /^(?:(?:===|==|~=|!=|<=|>=|<|>)\s*[0-9][a-zA-Z0-9.*+_-]*\s*,?\s*)+$/;

export function skillBaseTool(req) {
  if (req?.kind !== "bin") return null;
  return { node: "node", nodejs: "node", npm: "node", npx: "node", ffmpeg: "ffmpeg", docker: "docker", java: "jdk", jadx: "jadx", analyzeHeadless: "ghidra", "agent-reach": "agent-reach", "rea-video": "rea-video" }[req.name] ?? null;
}

export function skillRequirementId(req) {
  return createHash("sha256").update(JSON.stringify([req.directory, req.kind, req.name, req.required ?? ""])).digest("hex");
}

export function skillPackageSpec(req) {
  if (typeof req?.name !== "string") return null;
  if (req.required !== undefined && typeof req.required !== "string") return null;
  const version = req.required?.trim();
  if (req.kind === "npm" && NPM.test(req.name) && req.name.length <= 214) {
    if (version && !NPM_VERSION.test(version)) return null;
    return req.name + (version ? `@${version}` : "");
  }
  if (req.kind === "python" && PYTHON.test(req.name) && req.name.length <= 214) {
    if (version && !PYTHON_VERSION.test(version)) return null;
    return req.name + (version ?? "");
  }
  return null;
}

export function skillInstallPackages(req) {
  if (skillBaseTool(req)) return [req.name];
  const spec = skillPackageSpec(req);
  if (!spec) throw new Error("This requirement needs manual setup");
  if (req.kind === "npm" && ["remotion", "@remotion/cli"].includes(req.name)) {
    const suffix = req.required?.trim() ? `@${req.required.trim()}` : "";
    return [`remotion${suffix}`, `@remotion/cli${suffix}`];
  }
  return [spec];
}

/** Only registry package specs from a current scan may reach the package manager. Skill text is never a command. */
export async function installSkillPackage({ requirement, project, node, npmCli, python, run, platform = process.platform }) {
  const packages = skillInstallPackages(requirement);
  if (typeof project !== "string" || !path.isAbsolute(project)) throw new Error("Choose an existing project folder");
  const cwd = await fsp.realpath(project);
  if (!(await fsp.stat(cwd)).isDirectory()) throw new Error("Choose a project folder");
  if (requirement.kind === "npm") {
    if (!node || !npmCli) throw new Error("Install Node.js with npm first");
    const manifest = path.join(cwd, "package.json");
    try {
      JSON.parse(await fsp.readFile(manifest, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("The project package.json is invalid or unreadable");
      await fsp.writeFile(manifest, JSON.stringify({ name: "limix-skill-project", version: "1.0.0", private: true }, null, 2) + "\n", { flag: "wx" });
    }
    await run(node, [npmCli, "install", "--save-exact", "--no-audit", "--no-fund", "--", ...packages], { cwd });
  } else {
    const env = path.join(cwd, ".venv");
    const executable = path.join(env, platform === "win32" ? "Scripts/python.exe" : "bin/python");
    try { await fsp.access(executable); } catch {
      if (!python) throw new Error("Python is not available");
      try { await fsp.access(env); throw new Error("The existing .venv has no usable Python interpreter"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      await run(python, ["-m", "venv", env], { cwd });
    }
    await run(executable, ["-m", "pip", "install", "--disable-pip-version-check", "--", ...packages], { cwd });
  }
  return cwd;
}
