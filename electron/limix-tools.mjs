// Limix Bot: one-click install of the programs the default skills and the suggested MCP need on a new Windows computer.
// Everything goes to userData/limix-tools (no administrator rights, kept across app updates); limix-runtime.mjs puts
// these folders on every agent's PATH, so a tool works in the next turn without restarting Limix Bot.
// Downloads come from each project's official site, and each file is checked against the SHA-256 that site publishes.
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { limixRuntimeEnv } from "./limix-runtime.mjs";

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
  { id: "docker", name: "Docker Desktop", why: "Chạy máy tính ảo riêng cho từng bot. Cài qua winget: Windows sẽ hỏi quyền quản trị; bấm Cài là đồng ý điều khoản của Docker. Cài xong khởi động lại máy, mở Docker Desktop một lần.", size: "~600 MB", recommended: true },
  { id: "node", name: "Node.js", why: "Chạy các máy chủ MCP (như rea) và công cụ viết bằng JavaScript.", size: "~30 MB", recommended: true },
  { id: "ffmpeg", name: "ffmpeg", why: "Xử lý video và âm thanh. Kỹ năng rea-video cần.", size: "~80 MB", recommended: true },
  { id: "agent-reach", name: "Agent-Reach", why: "Đọc X/Twitter, Reddit, YouTube, GitHub… cho kỹ năng Agent-Reach.", size: "~40 MB", recommended: true },
  { id: "rea-video", name: "rea-video", why: "Mổ xẻ cách làm một video. Cần ffmpeg.", size: "~400 MB", recommended: true, needs: ["ffmpeg"] },
  { id: "jdk", name: "Java (JDK 21)", why: "JADX và Ghidra cần Java.", size: "~190 MB" },
  { id: "jadx", name: "JADX", why: "Dịch ngược ứng dụng Android (APK) cho rea.", size: "~30 MB", needs: ["jdk"] },
  { id: "ghidra", name: "Ghidra", why: "Dịch ngược file .exe/.dll cho rea. Chỉ dùng với phần mềm bạn có quyền.", size: "~450 MB", needs: ["jdk"] },
  { id: "rea", name: "rea (MCP)", why: "Máy chủ MCP dịch ngược phần mềm. Được thêm vào danh sách MCP ở trạng thái tắt.", size: "tải khi bật", needs: ["node"] },
];

export function createLimixTools({ userData, resourcesPath, serverRequest, log = () => {}, fetchImpl = globalThis.fetch }) {
  const p = limixToolPaths(userData);
  const runtime = limixRuntimeEnv({ resourcesPath, userData });
  const python = runtime.LIMIX_PYTHON;
  const uv = path.join(resourcesPath, "limix-runtime", "uv", process.platform === "win32" ? "uv.exe" : "uv");
  const jobs = new Map(); // id -> { status: "working" | "error", step, progress, message }
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

  const onPath = (name) => (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)
    .some((dir) => fs.existsSync(path.join(dir, exe(name))));
  const installed = async (id) => {
    const has = (file) => fs.existsSync(file);
    switch (id) {
      case "docker": return onPath("docker") || onPath("podman")
        || has(path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Docker", "Docker", "resources", "bin", "docker.exe"))
        || has(path.join(process.env.ProgramFiles ?? "C:\\Program Files", "RedHat", "Podman", "podman.exe"));
      case "node": return has(path.join(p.node, exe("node")));
      case "ffmpeg": return has(path.join(p.ffmpeg, "bin", exe("ffmpeg")));
      case "agent-reach": return has(path.join(p.bin, exe("agent-reach")));
      case "rea-video": return has(path.join(p.bin, exe("rea-video")));
      case "jdk": return has(path.join(p.jdk, "bin", exe("java")));
      case "jadx": return has(path.join(p.jadx, "bin", process.platform === "win32" ? "jadx.bat" : "jadx"));
      case "ghidra": return has(path.join(p.ghidra, "support", process.platform === "win32" ? "analyzeHeadless.bat" : "analyzeHeadless"));
      case "rea": return reaAdded();
      default: return false;
    }
  };

  const state = async () => {
    const items = [];
    for (const tool of CATALOG) {
      const job = jobs.get(tool.id);
      items.push({ ...tool, needs: tool.needs ?? [], installed: await installed(tool.id), job: job ?? null });
    }
    return { supported: process.platform === "win32" && Boolean(python), items };
  };

  const set = (id, patch) => jobs.set(id, { ...(jobs.get(id) ?? { status: "working", progress: null }), ...patch });

  async function getJson(url) {
    const res = await fetchImpl(url, { headers: UA });
    if (!res.ok) throw new Error(`Không tải được ${new URL(url).host} (lỗi ${res.status}).`);
    return res.json();
  }
  async function getText(url) {
    const res = await fetchImpl(url, { headers: { "user-agent": UA["user-agent"] } });
    if (!res.ok) throw new Error(`Không tải được ${new URL(url).host} (lỗi ${res.status}).`);
    return res.text();
  }

  async function download(id, url, sha256) {
    await fsp.mkdir(p.tools, { recursive: true });
    const file = path.join(p.tools, `.download-${id}`);
    const res = await fetchImpl(url, { headers: { "user-agent": UA["user-agent"] }, redirect: "follow" });
    if (!res.ok || !res.body) throw new Error(`Không tải được file (lỗi ${res.status}).`);
    const total = Number(res.headers.get("content-length")) || 0;
    const hash = crypto.createHash("sha256");
    const out = fs.createWriteStream(file);
    let got = 0;
    try {
      for await (const chunk of res.body) {
        hash.update(chunk);
        got += chunk.length;
        if (!out.write(chunk)) await new Promise((resolve) => out.once("drain", resolve));
        set(id, { step: "Đang tải", progress: total ? got / total : null });
      }
    } finally {
      await new Promise((resolve) => out.end(resolve));
    }
    const digest = hash.digest("hex");
    if (sha256 && digest.toLowerCase() !== sha256.toLowerCase()) {
      await fsp.rm(file, { force: true });
      throw new Error("File tải về không khớp mã kiểm tra. Đã hủy để an toàn, hãy thử lại.");
    }
    return file;
  }

  function run(command, args, env = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { env: { ...process.env, ...runtime, ...env }, windowsHide: true });
      let tail = "";
      const keep = (data) => { tail = (tail + String(data)).slice(-600); };
      child.stdout.on("data", keep);
      child.stderr.on("data", keep);
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`Cài không thành công (mã ${code}). ${tail.trim().split("\n").pop() ?? ""}`))));
    });
  }

  /** Unzips with the bundled Python, then moves the archive's single top folder (if any) to `target`. */
  async function unpack(id, zip, target) {
    set(id, { step: "Đang giải nén", progress: null });
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
    if (!asset) throw new Error(`Không tìm thấy bản cài ${repo} cho Windows.`);
    return { url: asset.browser_download_url, sha256: sha256Of(asset.digest), name: asset.name };
  }

  const installers = {
    async docker() {
      set("docker", { step: "Đang cài qua winget, Windows sẽ hỏi quyền quản trị", progress: null });
      try {
        await run("winget", ["install", "-e", "--id", "Docker.DockerDesktop", "--accept-source-agreements", "--accept-package-agreements", "--silent"]);
      } catch (error) {
        if (error?.code === "ENOENT") throw new Error("Máy chưa có winget (App Installer). Cài App Installer từ Microsoft Store rồi thử lại, hoặc tải Docker Desktop ở docker.com.");
        throw error;
      }
      if (!(await installed("docker"))) throw new Error("Đã cài xong. Khởi động lại máy rồi mở Docker Desktop một lần.");
    },
    async node() {
      const index = await getJson("https://nodejs.org/dist/index.json");
      const pick = index.find((v) => v.lts && (v.files ?? []).includes("win-x64-zip"));
      if (!pick) throw new Error("Không tìm thấy bản Node.js LTS.");
      const name = `node-${pick.version}-win-x64.zip`;
      const sums = await getText(`https://nodejs.org/dist/${pick.version}/SHASUMS256.txt`);
      const sha = sums.split("\n").map((l) => l.trim().split(/\s+/)).find((parts) => parts[1] === name)?.[0];
      if (!sha) throw new Error("Không có mã kiểm tra cho Node.js.");
      await unpack("node", await download("node", `https://nodejs.org/dist/${pick.version}/${name}`, sha), p.node);
    },
    async ffmpeg() {
      const base = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/";
      const name = "ffmpeg-master-latest-win64-gpl.zip";
      const sums = await getText(`${base}checksums.sha256`);
      const sha = sums.split("\n").map((l) => l.trim().split(/\s+/)).find((parts) => parts[1]?.replace(/^\*/, "") === name)?.[0];
      if (!sha) throw new Error("Không có mã kiểm tra cho ffmpeg.");
      await unpack("ffmpeg", await download("ffmpeg", base + name, sha), p.ffmpeg);
    },
    async "agent-reach"() {
      set("agent-reach", { step: "Đang cài", progress: null });
      await run(uv, ["tool", "install", "--force", "https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip"]);
    },
    async "rea-video"() {
      set("rea-video", { step: "Đang cài (khá lâu)", progress: null });
      await run(uv, ["tool", "install", "--force", `rea-video[ocr] @ https://github.com/JuneYaooo/rea-video/archive/${REA_VIDEO_COMMIT}.zip`]);
    },
    async jdk() {
      const list = await getJson("https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse");
      const pkg = list?.[0]?.binary?.package;
      if (!pkg?.link || !pkg?.checksum) throw new Error("Không tìm thấy bản Java 21 cho Windows.");
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
      set("rea", { step: "Đang thêm vào MCP", progress: null });
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
        throw new Error(body?.error || `Không thêm được rea vào MCP (lỗi ${status}).`);
      }
    },
  };

  async function installOne(id, seen = new Set()) {
    const tool = CATALOG.find((t) => t.id === id);
    if (!tool || seen.has(id)) return;
    seen.add(id);
    for (const need of tool.needs ?? []) if (!(await installed(need))) await installOne(need, seen);
    if (await installed(id)) return;
    set(id, { status: "working", step: "Chuẩn bị", progress: null, message: null });
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
    for (const id of list) set(id, { status: "working", step: "Đang chờ", progress: null, message: null });
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

  return { state, install, shouldAsk, markAsked };
}
