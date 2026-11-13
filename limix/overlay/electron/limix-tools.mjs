// Limix Bot: one-click install of the programs the default skills and the suggested MCP need on a new Windows computer.
// Everything goes to userData/limix-tools (no administrator rights, kept across app updates); limix-runtime.mjs puts
// these folders on every agent's PATH, so a tool works in the next turn without restarting Limix Bot.
// Downloads come from each project's official site, and each file is checked against the SHA-256 that site publishes.
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";

import { limixRuntimeEnv } from "./limix-runtime.mjs";
import { lxm } from "./limix-lang.mjs";
import { skillRequirementId, skillPackageSpec, skillBaseTool, skillInstallPackages, installSkillPackage } from "./limix-skill-install.mjs";

const REA_MCP_PACKAGE = "rea-agents@6.8.0";
const REA_VIDEO_COMMIT = "3669923645e3953632e7406a57fb883e0ba8a6e0";
const UA = { "user-agent": "LimixBot-tools", accept: "application/json" };

export function limixToolPaths(userData) {
  const tools = path.join(userData, "limix-tools");
  return {
    tools,
    node: path.join(tools, "node"),
    ffmpeg: path.join(tools, "ffmpeg"),
    jdk: path.join(tools, "jdk"),
    jadx: path.join(tools, "jadx"),
    ghidra: path.join(tools, "ghidra"),
    bin: path.join(tools, "bin"),
  };
}

/** The folders put on PATH (they may not exist yet; a missing folder on PATH is harmless). */
export function limixToolPathDirs(userData) {
  const p = limixToolPaths(userData);
  return [p.node, path.join(p.ffmpeg, "bin"), path.join(p.jdk, "bin"), path.join(p.jadx, "bin"), path.join(p.ghidra, "support")];
}

/** The list the window shows. `recommended` ones are asked about once on a new computer. */
const CATALOG = [
  { id: "docker", name: "Docker Desktop", get why() { return lxm("Chạy máy tính ảo riêng cho từng bot. Cài qua winget: Windows sẽ hỏi quyền quản trị; bấm Cài là đồng ý điều khoản của Docker. Cài xong khởi động lại máy, mở Docker Desktop một lần.", "Runs a private virtual computer for each bot. Installed through winget: Windows will ask for administrator permission, and pressing Install accepts Docker\'s terms. Restart the computer afterwards and open Docker Desktop once."); }, size: "~600 MB", recommended: true },
  { id: "node", name: "Node.js", get why() { return lxm("Chạy các máy chủ MCP (như rea) và công cụ viết bằng JavaScript.", "Runs MCP servers (like rea) and tools written in JavaScript."); }, size: "~30 MB", recommended: true },
  { id: "ffmpeg", name: "ffmpeg", get why() { return lxm("Xử lý video và âm thanh. Kỹ năng rea-video cần.", "Processes video and audio. The rea-video skill needs it."); }, size: "~80 MB", recommended: true },
  { id: "agent-reach", name: "Agent-Reach", get why() { return lxm("Đọc X/Twitter, Reddit, YouTube, GitHub… cho kỹ năng Agent-Reach.", "Reads X/Twitter, Reddit, YouTube, GitHub… for the Agent-Reach skill."); }, size: "~40 MB", recommended: true },
  { id: "rea-video", name: "rea-video", get why() { return lxm("Mổ xẻ cách làm một video. Cần ffmpeg.", "Breaks down how a video was made. Needs ffmpeg."); }, size: "~400 MB", recommended: true, needs: ["ffmpeg"] },
  { id: "jdk", name: "Java (JDK 21)", get why() { return lxm("JADX và Ghidra cần Java.", "JADX and Ghidra need Java."); }, size: "~190 MB" },
  { id: "jadx", name: "JADX", get why() { return lxm("Dịch ngược ứng dụng Android (APK) cho rea.", "Decompiles Android apps (APK) for rea."); }, size: "~30 MB", needs: ["jdk"] },
  { id: "ghidra", name: "Ghidra", get why() { return lxm("Dịch ngược file .exe/.dll cho rea. Chỉ dùng với phần mềm bạn có quyền.", "Decompiles .exe/.dll files for rea. Only use it on software you have the right to analyze."); }, size: "~450 MB", needs: ["jdk"] },
  { id: "rea", name: "rea (MCP)", get why() { return lxm("Máy chủ MCP dịch ngược phần mềm. Được thêm vào danh sách MCP ở trạng thái tắt.", "MCP server for reverse-engineering software. It is added to the MCP list switched off."); }, get size() { return lxm("tải khi bật", "downloaded when switched on"); }, needs: ["node"] },
];

export function createLimixTools({ userData, resourcesPath, serverRequest, log = () => {}, fetchImpl = globalThis.fetch }) {
  const p = limixToolPaths(userData);
  const runtime = limixRuntimeEnv({ resourcesPath, userData });
  const python = runtime.LIMIX_PYTHON;
  const uv = path.join(resourcesPath, "limix-runtime", "uv", process.platform === "win32" ? "uv.exe" : "uv");
  const jobs = new Map(); // id -> { status: "working" | "error", step, progress, message }
  let skillScan = null;
  const requirementJobs = new Map();
  const projectFile = path.join(p.tools, "skill-projects.json");
  let skillProjects = [];
  try { const saved = JSON.parse(fs.readFileSync(projectFile, "utf8")); if (Array.isArray(saved)) skillProjects = saved.filter((v) => typeof v === "string" && path.isAbsolute(v)); } catch {}
  let queue = Promise.resolve();
  const exe = (name) => (process.platform === "win32" ? `${name}.exe` : name);

  const reaAdded = async () => {
    try {
      const res = await serverRequest("/api/mcp/servers", { method: "GET" });
      const body = typeof res?.json === "function" ? await res.json() : res;
      const list = Array.isArray(body?.servers) ? body.servers : Object.entries(body?.servers ?? {}).map(([name, v]) => ({ name, ...v }));
      return list.some((s) => String(s?.name ?? "").toLowerCase() === "rea");
    } catch {
      return false;
    }
  };

  // Tools the person already has: Limix Bot uses them where they are and never installs a second copy.
  // The PATH of a running app is frozen at launch, so a rescan also reads the current Machine and User PATH from Windows.
  let freshPath = [];
  const expandVars = (text) => text.replace(/%([^%]+)%/g, (_m, name) => process.env[name] ?? "");
  async function rescan() {
    if (process.platform !== "win32") { freshPath = []; return; }
    const text = await new Promise((resolve) => {
      execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "[Environment]::GetEnvironmentVariable('Path','Machine')+';'+[Environment]::GetEnvironmentVariable('Path','User')"],
        { timeout: 8000, windowsHide: true }, (error, stdout) => resolve(error ? "" : String(stdout)));
    });
    freshPath = expandVars(text).split(";").map((dir) => dir.trim()).filter(Boolean);
  }
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const extraDirs = () => [
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "nodejs"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links"),
    path.join(process.env.ProgramData ?? "C:\\ProgramData", "chocolatey", "bin"),
    path.join(home, "scoop", "shims"),
    path.join(home, ".local", "bin"),
    path.join(process.env.APPDATA ?? "", "npm"),
    ...(process.env.JAVA_HOME ? [path.join(process.env.JAVA_HOME, "bin")] : []),
    ...(process.env.GHIDRA_INSTALL_DIR ? [path.join(process.env.GHIDRA_INSTALL_DIR, "support")] : []),
  ];
  const searchDirs = () => [...(process.env.PATH ?? "").split(path.delimiter), ...freshPath, ...extraDirs()].filter(Boolean);
  const winExts = process.platform === "win32" ? [".exe", ".cmd", ".bat", ".com"] : [""];
  /** First place on this computer where `name` runs, or null. */
  const findOnSystem = (name) => {
    for (const dir of searchDirs()) {
      for (const ext of winExts) {
        const file = path.join(dir, name + ext);
        try { if (fs.statSync(file).isFile()) return file; } catch { /* not here */ }
      }
    }
    return null;
  };
  const javaMajor = (file) => new Promise((resolve) => {
    execFile(file, ["-version"], { timeout: 6000, windowsHide: true }, (error, stdout, stderr) => {
      const m = /version "(\d+)(?:\.(\d+))?/.exec(`${stderr}${stdout}`);
      resolve(m ? (m[1] === "1" ? Number(m[2]) : Number(m[1])) : 0);
    });
  });
  const exeIn = (dir, name) => { for (const ext of winExts) { const f = path.join(dir, name + ext); if (fs.existsSync(f)) return f; } return null; };

  /** Where a tool is: { from: "limix" | "system", where } or null. Limix's own copy wins; otherwise what the person installed. */
  const locate = async (id) => {
    const own = (file) => (file && fs.existsSync(file) ? { from: "limix", where: file } : null);
    const sys = (file) => (file ? { from: "system", where: file } : null);
    switch (id) {
      case "docker": return sys(findOnSystem("docker") ?? findOnSystem("podman")
        ?? [path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "resources", "bin", "docker.exe"),
            path.join(process.env.ProgramFiles ?? "C:\\Program Files", "RedHat", "Podman", "podman.exe")].find((f) => fs.existsSync(f)) ?? null);
      case "node": return own(path.join(p.node, exe("node"))) ?? sys(findOnSystem("node"));
      case "ffmpeg": return own(path.join(p.ffmpeg, "bin", exe("ffmpeg"))) ?? sys(findOnSystem("ffmpeg"));
      case "agent-reach": return own(path.join(p.bin, exe("agent-reach"))) ?? sys(findOnSystem("agent-reach"));
      case "rea-video": return own(path.join(p.bin, exe("rea-video"))) ?? sys(findOnSystem("rea-video"));
      case "jdk": {
        const mine = own(path.join(p.jdk, "bin", exe("java")));
        if (mine) return mine;
        const theirs = findOnSystem("java");
        return theirs && (await javaMajor(theirs)) >= 17 ? sys(theirs) : null; // JADX and Ghidra need Java 17 or newer
      }
      case "jadx": return own(exeIn(path.join(p.jadx, "bin"), "jadx")) ?? sys(findOnSystem("jadx"));
      case "ghidra": return own(exeIn(path.join(p.ghidra, "support"), "analyzeHeadless")) ?? sys(findOnSystem("analyzeHeadless"));
      case "rea": return (await reaAdded()) ? { from: "limix", where: "MCP" } : null;
      default: return null;
    }
  };
  const installed = async (id) => Boolean(await locate(id));

  const state = async ({ rescanPath = false } = {}) => {
    if (rescanPath || freshPath.length === 0) await rescan();
    const items = [];
    for (const tool of CATALOG) {
      const job = jobs.get(tool.id);
      const found = await locate(tool.id);
      items.push({ ...tool, needs: tool.needs ?? [], installed: Boolean(found), source: found?.from ?? null, where: found?.where ?? null, job: job ?? null });
    }
    const report = skillScan ? { ...skillScan, requirements: skillScan.requirements?.map((req) => ({ ...req, id: skillRequirementId(req), installable: Boolean(skillPackageSpec(req) || skillBaseTool(req)), packages: skillPackageSpec(req) || skillBaseTool(req) ? skillInstallPackages(req) : [], job: requirementJobs.get(skillRequirementId(req)) ?? null })) } : null;
    return { supported: process.platform === "win32" && Boolean(python), items, skillScan: report };
  };

  const set = (id, patch) => jobs.set(id, { ...(jobs.get(id) ?? { status: "working", progress: null }), ...patch });

  async function getJson(url) {
    const res = await fetchImpl(url, { headers: UA });
    if (!res.ok) throw new Error(lxm(`Không tải được ${new URL(url).host} (lỗi ${res.status}).`, `Couldn't download from ${new URL(url).host} (error ${res.status}).`));
    return res.json();
  }
  async function getText(url) {
    const res = await fetchImpl(url, { headers: { "user-agent": UA["user-agent"] } });
    if (!res.ok) throw new Error(lxm(`Không tải được ${new URL(url).host} (lỗi ${res.status}).`, `Couldn't download from ${new URL(url).host} (error ${res.status}).`));
    return res.text();
  }

  async function download(id, url, sha256) {
    await fsp.mkdir(p.tools, { recursive: true });
    const file = path.join(p.tools, `.download-${id}`);
    const res = await fetchImpl(url, { headers: { "user-agent": UA["user-agent"] }, redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(lxm(`Không tải được file (lỗi ${res.status}).`, `Couldn't download the file (error ${res.status}).`));
    const total = Number(res.headers.get("content-length")) || 0;
    const hash = crypto.createHash("sha256");
    const out = fs.createWriteStream(file);
    let got = 0;
    try {
      for await (const chunk of res.body) {
        hash.update(chunk);
        got += chunk.length;
        if (!out.write(chunk)) await new Promise((resolve) => out.once("drain", resolve));
        set(id, { step: lxm("Đang tải", "Downloading"), progress: total ? got / total : null });
      }
    } finally {
      await new Promise((resolve) => out.end(resolve));
    }
    const digest = hash.digest("hex");
    if (sha256 && digest.toLowerCase() !== sha256.toLowerCase()) {
      await fsp.rm(file, { force: true });
      throw new Error(lxm("File tải về không khớp mã kiểm tra. Đã hủy để an toàn, hãy thử lại.", "The downloaded file does not match its checksum. Cancelled for safety, please try again."));
    }
    return file;
  }

  function run(command, args, env = {}, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { env: { ...process.env, ...runtime, ...env }, ...options, windowsHide: true });
      let tail = "";
      const keep = (data) => { tail = (tail + String(data)).slice(-600); };
      child.stdout.on("data", keep);
      child.stderr.on("data", keep);
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(lxm(`Cài không thành công (mã ${code}). `, `Install failed (code ${code}). `) + (tail.trim().split("\n").pop() ?? "")))));
    });
  }

  /** Unzips with the bundled Python, then moves the archive's single top folder (if any) to `target`. */
  async function unpack(id, zip, target) {
    set(id, { step: lxm("Đang giải nén", "Extracting"), progress: null });
    const tmp = path.join(p.tools, `.unpack-${id}`);
    await fsp.rm(tmp, { recursive: true, force: true });
    await fsp.mkdir(tmp, { recursive: true });
    await run(python, ["-I", "-m", "zipfile", "-e", zip, tmp]);
    const entries = await fsp.readdir(tmp, { withFileTypes: true });
    const source = entries.length === 1 && entries[0].isDirectory() ? path.join(tmp, entries[0].name) : tmp;
    await fsp.rm(target, { recursive: true, force: true });
    await fsp.rename(source, target);
    await fsp.rm(tmp, { recursive: true, force: true });
    await fsp.rm(zip, { force: true });
  }

  const sha256Of = (digest) => (typeof digest === "string" && digest.startsWith("sha256:") ? digest.slice(7) : null);

  async function githubAsset(repo, pattern) {
    const release = await getJson(`https://api.github.com/repos/${repo}/releases/latest`);
    const asset = (release.assets ?? []).find((a) => pattern.test(a.name));
    if (!asset) throw new Error(lxm(`Không tìm thấy bản cài ${repo} cho Windows.`, `No Windows build of ${repo} was found.`));
    return { url: asset.browser_download_url, sha256: sha256Of(asset.digest), name: asset.name };
  }

  const installers = {
    async docker() {
      set("docker", { step: lxm("Đang cài qua winget, Windows sẽ hỏi quyền quản trị", "Installing through winget, Windows will ask for administrator permission"), progress: null });
      try {
        await run("winget", ["install", "-e", "--id", "Docker.DockerDesktop", "--accept-source-agreements", "--accept-package-agreements", "--silent"]);
      } catch (error) {
        if (error?.code === "ENOENT") throw new Error(lxm("Máy chưa có winget (App Installer). Cài App Installer từ Microsoft Store rồi thử lại, hoặc tải Docker Desktop ở docker.com.", "This computer has no winget (App Installer). Install App Installer from the Microsoft Store and retry, or download Docker Desktop from docker.com."));
        throw error;
      }
      if (!(await installed("docker"))) throw new Error(lxm("Đã cài xong. Khởi động lại máy rồi mở Docker Desktop một lần.", "Installed. Restart the computer, then open Docker Desktop once."));
    },
    async node() {
      const index = await getJson("https://nodejs.org/dist/index.json");
      const pick = index.find((v) => v.lts && (v.files ?? []).includes("win-x64-zip"));
      if (!pick) throw new Error(lxm("Không tìm thấy bản Node.js LTS.", "No Node.js LTS build was found."));
      const name = `node-${pick.version}-win-x64.zip`;
      const sums = await getText(`https://nodejs.org/dist/${pick.version}/SHASUMS256.txt`);
      const sha = sums.split("\n").map((l) => l.trim().split(/\s+/)).find((parts) => parts[1] === name)?.[0];
      if (!sha) throw new Error(lxm("Không có mã kiểm tra cho Node.js.", "No checksum available for Node.js."));
      await unpack("node", await download("node", `https://nodejs.org/dist/${pick.version}/${name}`, sha), p.node);
    },
    async ffmpeg() {
      const base = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/";
      const name = "ffmpeg-master-latest-win64-gpl.zip";
      const sums = await getText(`${base}checksums.sha256`);
      const sha = sums.split("\n").map((l) => l.trim().split(/\s+/)).find((parts) => parts[1]?.replace(/^\*/, "") === name)?.[0];
      if (!sha) throw new Error(lxm("Không có mã kiểm tra cho ffmpeg.", "No checksum available for ffmpeg."));
      await unpack("ffmpeg", await download("ffmpeg", base + name, sha), p.ffmpeg);
    },
    async "agent-reach"() {
      set("agent-reach", { step: lxm("Đang cài", "Installing"), progress: null });
      await run(uv, ["tool", "install", "--force", "https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip"]);
    },
    async "rea-video"() {
      set("rea-video", { step: lxm("Đang cài (khá lâu)", "Installing (this takes a while)"), progress: null });
      await run(uv, ["tool", "install", "--force", `rea-video[ocr] @ https://github.com/JuneYaooo/rea-video/archive/${REA_VIDEO_COMMIT}.zip`]);
    },
    async jdk() {
      const list = await getJson("https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse");
      const pkg = list?.[0]?.binary?.package;
      if (!pkg?.link || !pkg?.checksum) throw new Error(lxm("Không tìm thấy bản Java 21 cho Windows.", "No Java 21 build for Windows was found."));
      await unpack("jdk", await download("jdk", pkg.link, pkg.checksum), p.jdk);
    },
    async jadx() {
      const a = await githubAsset("skylot/jadx", /^jadx-\d[\d.]*\.zip$/);
      await unpack("jadx", await download("jadx", a.url, a.sha256), p.jadx);
    },
    async ghidra() {
      const a = await githubAsset("NationalSecurityAgency/ghidra", /^ghidra_.*_PUBLIC_\d+\.zip$/);
      await unpack("ghidra", await download("ghidra", a.url, a.sha256), p.ghidra);
    },
    async rea() {
      set("rea", { step: lxm("Đang thêm vào MCP", "Adding to MCP"), progress: null });
      const node = path.join(p.node, exe("node"));
      const npx = path.join(p.node, "node_modules", "npm", "bin", "npx-cli.js");
      const config = { mcpServers: { rea: { command: node, args: [npx, "-y", REA_MCP_PACKAGE, "mcp"] } } };
      const res = await serverRequest("/api/mcp/servers/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: JSON.stringify(config) }),
      });
      const status = typeof res?.status === "number" ? res.status : 200;
      if (status >= 300) {
        const body = typeof res?.json === "function" ? await res.json().catch(() => ({})) : res;
        throw new Error(body?.error || lxm(`Không thêm được rea vào MCP (lỗi ${status}).`, `Couldn't add rea to MCP (error ${status}).`));
      }
    },
  };

  async function installOne(id, seen = new Set()) {
    const tool = CATALOG.find((t) => t.id === id);
    if (!tool || seen.has(id)) return;
    seen.add(id);
    for (const need of tool.needs ?? []) if (!(await installed(need))) await installOne(need, seen);
    if (await installed(id)) return;
    set(id, { status: "working", step: lxm("Chuẩn bị", "Preparing"), progress: null, message: null });
    try {
      await installers[id]();
      jobs.delete(id);
      log(`limix tools: installed ${id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set(id, { status: "error", step: null, progress: null, message });
      log(`limix tools: ${id} failed: ${message}`);
      throw error;
    }
  }

  /** Starts in the background (one at a time) and returns at once; the window polls state(). */
  function install(ids) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => CATALOG.some((t) => t.id === id));
    for (const id of list) set(id, { status: "working", step: lxm("Đang chờ", "Waiting"), progress: null, message: null });
    queue = queue.then(async () => {
      for (const id of list) await installOne(id).catch(() => {});
    });
    return state();
  }

  const promptFile = path.join(p.tools, "asked.json");
  /** True once per computer while a recommended tool is missing: the window then asks "install now?". */
  async function shouldAsk() {
    if (process.platform !== "win32" || !python) return false;
    try {
      if (fs.existsSync(promptFile)) return false;
    } catch {
      return false;
    }
    for (const tool of CATALOG) if (tool.recommended && !(await installed(tool.id))) return true;
    return false;
  }
  async function markAsked() {
    await fsp.mkdir(p.tools, { recursive: true });
    await fsp.writeFile(promptFile, JSON.stringify({ at: new Date().toISOString() }));
  }

  const scan = async () => {
    await state({ rescanPath: true });
    try {
      const response = await serverRequest("/api/limix/skill-requirements/scan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projects: skillProjects }) });
      if (response?.ok === false) throw new Error(`HTTP ${response.status}`);
      skillScan = typeof response?.json === "function" ? await response.json() : response;
    } catch (error) {
      skillScan = { error: error instanceof Error ? error.message : String(error) };
    }
    return state();
  };
  const installRequirement = async (id, project) => {
    const req = skillScan?.requirements?.find((row) => skillRequirementId(row) === id);
    if (!req || !(skillPackageSpec(req) || skillBaseTool(req))) throw new Error(lxm("Hãy quét lại và chọn gói hợp lệ.", "Scan again and select a valid package."));
    if (typeof project !== "string" || !path.isAbsolute(project)) throw new Error(lxm("Chọn thư mục dự án cần cài.", "Choose the project folder to install into."));
    const cwd = await fsp.realpath(project);
    for (const protectedRoot of [resourcesPath, process.resourcesPath, ...[...(skillScan?.requirements ?? [])].map((r) => r.directory)].filter(Boolean)) {
      const rel = path.relative(path.resolve(protectedRoot), cwd);
      if (!rel || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel))) throw new Error(lxm("Hãy chọn thư mục dự án riêng ngoài thư mục ứng dụng và kỹ năng.", "Choose a project folder outside the app and skill directories."));
    }
    if (requirementJobs.get(id)?.status === "working") return state();
    requirementJobs.set(id, { status: "working", step: lxm("Đang cài vào ", "Installing into ") + cwd, project: cwd });
    queue = queue.then(async () => {
      try {
        const baseTool = skillBaseTool(req);
        if (baseTool) {
          await installOne(baseTool);
          requirementJobs.set(id, { status: "done", project: cwd });
          return;
        }
        skillProjects = [...new Set([...skillProjects, cwd])].slice(-200);
        await fsp.mkdir(p.tools, { recursive: true });
        await fsp.writeFile(projectFile, JSON.stringify(skillProjects));
        let node;
        let npmCli;
        if (req.kind === "npm") {
          node = (await locate("node"))?.where;
          npmCli = node && [path.join(path.dirname(node), "node_modules/npm/bin/npm-cli.js"), path.join(path.dirname(node), "../lib/node_modules/npm/bin/npm-cli.js")].find(fs.existsSync);
          if (!npmCli) {
            await installers.node();
            node = path.join(p.node, exe("node"));
            npmCli = path.join(p.node, "node_modules/npm/bin/npm-cli.js");
          }
        }
        await installSkillPackage({ requirement: req, project: cwd, node, npmCli, python: python ?? findOnSystem("python") ?? findOnSystem("python3"), run: (command, args, options) => run(command, args, { PATH: [node && path.dirname(node), runtime.OMB_EXTRA_PATH, process.env.PATH].filter(Boolean).join(path.delimiter) }, options) });
        requirementJobs.set(id, { status: "done", project: cwd });
      } catch (error) {
        requirementJobs.set(id, { status: "error", project: cwd, message: error instanceof Error ? error.message : String(error) });
      }
      finally { await scan(); }
    }).catch((error) => { requirementJobs.set(id, { status: "error", project: cwd, message: String(error) }); });
    return state();
  };
  const installRequirements = async (ids, project) => {
    if (!Array.isArray(ids) || ids.length > 200) throw new Error("Invalid requirements list");
    const planned = new Set();
    for (const id of [...new Set(ids)]) {
      const req = skillScan?.requirements?.find((row) => skillRequirementId(row) === id);
      if (!req) throw new Error("Scan again before installing requirements");
      const key = JSON.stringify([req.kind, skillInstallPackages(req).sort()]);
      if (planned.has(key)) continue;
      planned.add(key);
      await installRequirement(id, project);
    }
    return state();
  };
  return { state, scan, install, installRequirement, installRequirements, shouldAsk, markAsked };
}
